---
date: "2026-09-03"
slug: "2026-09-03-opensandbox-project-study-notes"
layout: post
title: "OpenSandbox 项目学习笔记：从 CRD 到 bwrap、eBPF 与 Egress"
tags: ["opensandbox", "k8s", "sandbox", "linux", "ebpf"]
---

> 基于 [OpenSandbox 源码快照](https://github.com/opensandbox-group/OpenSandbox/tree/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482) 整理。
>
> 绑定提交：[`865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482`](https://github.com/opensandbox-group/OpenSandbox/commit/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482)（生成笔记时工作树为 clean）。

把本次对话中的问题整理成一条从浅到深的学习路线。先区分客户端、生命周期控制面、运行时和 Sandbox 数据面，再追踪 Kubernetes CRD、Pool 与 Snapshot，最后进入 Pod 内部理解 execd、bubblewrap、Linux Capabilities、eBPF、Ingress、DNS 与 nftables。所有结论固定在当前工作树源码快照；未实际启动 Kubernetes、内核 Namespace、eBPF 或 nftables 的内容均标记为源码推导，而不是本机运行证明。

## 一、先建立整体心智模型

```text
SDK / CLI / MCP
       │  REST /v1
       ▼
Lifecycle Server（Python + FastAPI，生命周期控制面）
       │
       ├── Docker Provider ───────► Docker Container
       │
       └── Kubernetes Provider ──► CRD / Controller ──► Sandbox Pod
                                                        │
                                                        ├── 用户工作负载
                                                        ├── execd（命令、文件、PTY、Session）
                                                        │      └── bwrap（Session 级子隔离）
                                                        │             └── Session Upper
                                                        └── Egress Sidecar
                                                               └── DNS Proxy + nftables

外部请求 ──► Ingress Gateway ──► Sandbox Pod 的目标端口
观测事件 ◄── execd-ebpf（进程执行、TCP 连接尝试、凭据/能力变化）
```


[![OpenSandbox 系统总览：客户端、生命周期控制面、可替换运行时、Sandbox 数据面与 Egress 边界](/images/opensandbox/opensandbox-system-map.png)](/images/opensandbox/opensandbox-system-map.png)

*图 1：OpenSandbox 系统总览。点击图片可查看高清版本；图中重点区分生命周期控制面、Docker/Kubernetes 运行时与 Sandbox 数据面。*

最重要的边界是：

- Lifecycle Server 管理 Sandbox 的创建、续期、暂停、恢复和删除。
- Docker/Kubernetes Provider 把统一生命周期语义翻译成具体运行时资源。
- execd 在 Sandbox 内部提供命令、文件、PTY、代码执行和隔离 Session。
- bwrap 在 Sandbox 容器里面继续建立 Session 级 Namespace、挂载和 seccomp 隔离。
- Ingress 管入站定位；Egress 管出站策略。
- eBPF 在当前设计中主要负责观察和审计，不负责代替隔离或拦截。

## 二、你之前问题的快速结论

| 问题 | 简短结论 |
|---|---|
| CRD bases 下三个 CRD 是什么？ | `BatchSandbox` 管期望工作负载，`Pool` 管预热 Pod，`SandboxSnapshot` 管 Kubernetes pause/resume 的 rootfs 快照。 |
| BatchSandbox 的多个 Sandbox 是同一个 Pod 吗？ | 不是。每个副本是独立 Pod，有自己的 UID、IP、生命周期和调度位置；默认只是从同一模板创建。 |
| `poolRef` 与 `template` 有什么区别？ | `template` 直接新建 Pod；`poolRef` 从 Pool 分配已经预热的 Pod；`poolRef: "*"` 会自动选择同命名空间 Pool。 |
| Pod 怎么变成 SandboxSnapshot？ | Controller 创建同节点 commit Job，通过 containerd 把容器可写 rootfs 提交为 OCI 镜像，并把结果写入 SandboxSnapshot。 |
| Resume 是恢复原进程吗？ | 不是。它把 Pod 模板镜像换成 snapshot image 后创建新 Pod；PID、内存、PTY、TCP 连接和原 Session 都不会恢复。 |
| Python、FastAPI、Go、Gin 分别是什么？ | Python/Go 是语言；FastAPI/Gin 是 Web 框架。Lifecycle Server 使用 FastAPI，execd HTTP 层使用 Gin；Ingress/Egress 并不都使用 Gin。 |
| Sandbox 是 Pod 最初创建的容器吗？ | “Sandbox”是逻辑运行环境。在 Kubernetes 中通常对应一个 Pod；Pod 内主容器运行用户镜像，旁边可能还有 init container 和 egress sidecar。 |
| execd 会自动嵌入吗？ | 默认模板模式下，execd-installer init container 把二进制和 bootstrap 脚本复制到共享 emptyDir，主容器再从该卷启动 execd。execd 是主容器里的进程，不是另一个普通 sidecar。 |
| `opensandbox/execd` 镜像里有什么？ | 主要包含 execd 二进制、bootstrap 脚本、bubblewrap 等运行依赖；installer 容器负责把这些文件交给用户主容器。普通 execd 与 execd-ebpf 是不同构建变体。 |
| bubblewrap 是什么？ | 一个 Linux 沙箱工具。它通过 Namespace、bind/Overlay mount、`pivot_root`、身份切换和 seccomp，为一个 Session 建立容器内的第二层隔离。 |
| bwrap 如何隔离 Session？ | 一个隔离 Session 启动一个长期存在的 `bwrap + shell`；后续 run 复用同一组 Namespace 和 Upper，并在同一 Session 内串行执行。 |
| Session Upper 是什么？ | 每个隔离 Session 的 OverlayFS 可写层，通常位于 `/var/lib/execd/isolation/<id>/upper`，不是管理员权限，也不是 SandboxSnapshot。 |
| execd-ebpf 监听哪些 Hook？ | `sched:sched_process_exec`、过滤到 `TCP_SYN_SENT` 的 `sock:inet_sock_set_state`、以及 `commit_creds` kprobe。范围是 Sandbox cgroup，不是单独 Session。 |
| Ingress/Egress 是 Kubernetes CR 吗？ | OpenSandbox 的 Ingress 与 Egress 本身是常驻组件/容器，不是这三个 CRD；Ingress 会观察 Sandbox 资源，Egress 作为每个 Sandbox 的 sidecar。 |
| nftables 规则写在哪里？ | 写在 egress 进程所在的 Pod Network Namespace 中。因为主容器和 sidecar 共享 Pod 网络栈，所以规则能约束主容器，但通常不是宿主机默认 NetNS 的全局规则。 |
| 为什么不把 NET_ADMIN 给用户 Sandbox？ | 用户拿到 NET_ADMIN 后可删除 nftables 规则、改路由和 DNS，使策略失效。可信 sidecar 持有 NET_ADMIN，主容器显式 drop，形成权限分离。 |
| DNS 与 nftables 怎么协作？ | Pod 的 53 端口请求被重定向到本地 DNS Proxy；域名允许后，Proxy 把 A/AAAA 和 TTL 写入 nftables 动态 allow set，然后才返回 DNS 结果。 |
| nftables 的 TTL 到期会断开长连接吗？ | TTL 实际是动态 set 元素的 lease。已有 TCP 通常因 `established,related` 规则继续放行，连接 tracker 还会定期刷新活动远端 IP；UDP/QUIC 不在该 TCP tracker 内。 |

## 三、按源码分层理解项目

## 阶段 01 · 先建立整张地图

### 1. 先用一张图说清 OpenSandbox

建立 Client → Lifecycle Server → Runtime → Sandbox 的主干，先不钻实现细节。

#### 本节覆盖的原问题

- OpenSandbox 到底是在管理容器，还是在容器里执行命令？
- 一条 SDK 请求会经过哪些边界？

#### 核心结论

最短心智模型：Lifecycle Server 管 Sandbox 的生命周期，execd 管 Sandbox 里面的命令、文件、PTY 和代码执行。前者在外面，后者在里面。

Ingress 解决外部请求如何找到某个 Sandbox 端口；Egress 解决 Sandbox 向外访问哪些域名或 IP。它们都不是 Sandbox 本体。

源码事实与运行事实要分开：本课能从代码证明组件关系，但没有启动集群，因此调度、内核和网络行为属于源码推导。

#### 关键概念

| 概念 | 含义 |
|---|---|
| CONTROL PLANE | Lifecycle Server 接收创建、续期、暂停、恢复和删除请求，并选择 Docker 或 Kubernetes 后端。 |
| DATA PLANE | 真正运行用户镜像、用户进程、execd 和网络策略的 Sandbox 环境。 |
| RUNTIME BACKEND | Docker 与 Kubernetes 是两套落地实现，共用对外生命周期语义，但资源对象与调度方式不同。 |

#### 工作流程

`SDK / CLI / MCP` → `Lifecycle Server` → `Docker 或 Kubernetes Provider` → `Sandbox` → `execd / 用户工作负载`

#### 源码位置

| 路径 | 阅读重点 | 作用 |
|---|---|---|
| [README.md](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/README.md) | OpenSandbox | 项目首页给出产品入口、SDK 和整体定位。 |
| [docs/architecture/index.md](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/docs/architecture/index.md) | Architecture Overview | 官方架构页明确客户端、公共契约、控制面、运行时和数据面的分层。 |

#### 定位源码的命令

```bash
rg -n "Lifecycle|Runtime|execd|Ingress|Egress" README.md docs/architecture/index.md
```

### 2. Python、FastAPI、Go、Gin 各自是什么

把编程语言、Web 框架、服务进程和 Kubernetes Controller 四种概念分开。

#### 本节覆盖的原问题

- 代码里的 Python、FastAPI、Gin 都是什么功能？
- 为什么一个项目同时使用 Python 和 Go？

#### 核心结论

Lifecycle Server 用 Python + FastAPI，适合声明 API 模型、异步 I/O、配置与运行时编排。

execd 用 Go + Gin：Gin 只负责把 /command、/files、/pty、/v1/isolated 等 HTTP 路由交给 controller，真正执行逻辑在 runtime 包。

Ingress 使用 Go 标准库 net/http 反向代理；Egress 的 DNS、策略 API、nftables 管理也不是 Gin。不要把 Go 服务都叫成 Gin 服务。

#### 关键概念

| 概念 | 含义 |
|---|---|
| LANGUAGE | Python 和 Go 是编程语言，决定代码语法、构建和运行方式。 |
| WEB FRAMEWORK | FastAPI 是 Python Web 框架；Gin 是 Go Web 框架。框架负责路由、中间件、参数解析和响应。 |
| SERVICE PROCESS | Lifecycle Server、execd、Ingress、Egress 是实际运行的进程；语言和框架只是实现它们的工具。 |

#### 工作流程

`Python` → `FastAPI` → `Lifecycle API` → `Go` → `Gin 仅用于 execd HTTP API`

#### 源码位置

| 路径 | 阅读重点 | 作用 |
|---|---|---|
| [server/opensandbox_server/main.py](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/server/opensandbox_server/main.py) | app = _DateHeaderFastAPI | FastAPI 应用、lifespan 和中间件的组合根。 |
| [components/execd/main.go](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/components/execd/main.go) | func main | 并排比较三个 Go 进程的组合根，确认只有 execd 的 Web 层使用 Gin。 |
| [components/execd/pkg/web/router.go](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/components/execd/pkg/web/router.go) | func main | 并排比较三个 Go 进程的组合根，确认只有 execd 的 Web 层使用 Gin。 |
| [components/ingress/main.go](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/components/ingress/main.go) | func main | 并排比较三个 Go 进程的组合根，确认只有 execd 的 Web 层使用 Gin。 |
| [components/egress/main.go](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/components/egress/main.go) | func main | 并排比较三个 Go 进程的组合根，确认只有 execd 的 Web 层使用 Gin。 |

#### 定位源码的命令

```bash
rg -n "FastAPI\(|gin.New\(|http.NewServeMux|func main" server/opensandbox_server components
```

### 3. 走通一次 Create → Exec → Delete

用一条 tracer-bullet 请求串起 API、Service、Provider、Sandbox 和 execd。

#### 本节覆盖的原问题

- SDK 创建 Sandbox 后，命令到底发给谁？
- 为什么有两个 HTTP 服务？

#### 核心结论

创建请求只负责得到一个 Sandbox 资源；运行命令则走 execd 的 /command、/code、/pty 或隔离 Session API。

Docker 与 Kubernetes 后端实现不同，但 FastAPI 路由不应包含这些后端细节，路由只做校验和委派。

Endpoint Access 可以由 Lifecycle Server 代理，也可以由独立 Ingress Gateway 路由。两者都把流量送到 Sandbox 内的目标端口。

#### 关键概念

| 概念 | 含义 |
|---|---|
| PUBLIC CONTRACT | 生命周期 OpenAPI 是 SDK 与 Server 的公共边界；execd OpenAPI 是 Sandbox 内执行边界。 |
| SERVICE ABSTRACTION | SandboxService 定义统一能力，Factory 按配置选择 DockerSandboxService 或 KubernetesSandboxService。 |
| TRACER BULLET | 先追一条端到端请求，建立所有权与调用方向，再研究局部模块。 |

#### 工作流程

`POST /sandboxes` → `FastAPI lifecycle route` → `SandboxService` → `Docker/Kubernetes Provider` → `Sandbox ready` → `Proxy/Ingress → execd` → `DELETE /sandboxes/{id}`

[![OpenSandbox 创建工作流：请求校验、运行时选择、工作负载创建、Running 状态与失败分支](/images/opensandbox/opensandbox-create-workflow.png)](/images/opensandbox/opensandbox-create-workflow.png)

*图 2：Sandbox 创建 Workflow，包含正常路径与请求校验、平台创建失败两条分支。*

[![OpenSandbox 创建与执行时序：Client、Lifecycle Server、Kubernetes Runtime、控制器和 execd 之间的调用关系](/images/opensandbox/opensandbox-create-sequence.png)](/images/opensandbox/opensandbox-create-sequence.png)

*图 3：创建与执行 Sequence。创建由生命周期控制面进入 Kubernetes 控制链；命令执行最终进入 Sandbox 内的 execd。*


#### 源码位置

| 路径 | 阅读重点 | 作用 |
|---|---|---|
| [server/opensandbox_server/api/lifecycle.py](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/server/opensandbox_server/api/lifecycle.py) | async def create_sandbox | 创建、查询、续期、暂停与删除等生命周期路由。 |
| [server/opensandbox_server/services/sandbox_service.py](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/server/opensandbox_server/services/sandbox_service.py) | create_sandbox_service | 统一接口与运行时后端工厂。 |
| [server/opensandbox_server/services/factory.py](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/server/opensandbox_server/services/factory.py) | create_sandbox_service | 统一接口与运行时后端工厂。 |
| [server/opensandbox_server/api/proxy.py](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/server/opensandbox_server/api/proxy.py) | proxy | Server 代理 HTTP/WebSocket 到 Sandbox endpoint 的另一条入口。 |

#### 定位源码的命令

```bash
rg -n "def create_sandbox|class SandboxService|create_sandbox_service|async def create_sandbox" server/opensandbox_server
```

## 阶段 02 · CRD、Pod 与生命周期

### 4. CRD bases 下面三个 CRD 是什么

从 Go 类型这个源头理解 BatchSandbox、Pool、SandboxSnapshot，而不是只读生成 YAML。

#### 本节覆盖的原问题

- 三个 CRD 分别解决什么问题？
- 它们都是 Kubernetes 自带资源吗？

#### 核心结论

它们属于 sandbox.opensandbox.io/v1alpha1，是 OpenSandbox 自定义资源，不是 Kubernetes 内置资源。

BatchSandbox 是最接近用户请求的资源；Pool 是预热基础设施；SandboxSnapshot 通常由 pause 流程内部创建。

kubernetes/config/crd/bases 下的 YAML 是 controller-gen 生成结果。学习和修改 schema 时先看 apis/sandbox/v1alpha1 的 Go 类型。

#### 关键概念

| 概念 | 含义 |
|---|---|
| BATCHSANDBOX | 描述期望的 Sandbox 副本、Pod 模板或 Pool 引用、任务、过期和 pause/resume 意图。 |
| POOL | 维护预热 Pod 缓冲区，负责容量、分配、更新与回收策略。 |
| SANDBOXSNAPSHOT | pause/resume 内部使用的根文件系统快照 CR，记录每个容器推送后的 OCI 镜像。 |

#### 工作流程

`用户/Server 创建 BatchSandbox` → `Controller 直接建 Pod 或向 Pool 分配` → `暂停时创建 SandboxSnapshot` → `Controller 更新 status`

#### 源码位置

| 路径 | 阅读重点 | 作用 |
|---|---|---|
| [kubernetes/apis/sandbox/v1alpha1/batchsandbox_types.go](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/kubernetes/apis/sandbox/v1alpha1/batchsandbox_types.go) | type BatchSandboxSpec | 三个 CRD 的 Go 类型是 schema 源头。 |
| [kubernetes/apis/sandbox/v1alpha1/pool_types.go](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/kubernetes/apis/sandbox/v1alpha1/pool_types.go) | type BatchSandboxSpec | 三个 CRD 的 Go 类型是 schema 源头。 |
| [kubernetes/apis/sandbox/v1alpha1/sandboxsnapshot_types.go](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/kubernetes/apis/sandbox/v1alpha1/sandboxsnapshot_types.go) | type BatchSandboxSpec | 三个 CRD 的 Go 类型是 schema 源头。 |
| [kubernetes/AGENTS.md](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/kubernetes/AGENTS.md) | Architecture Overview | 仓库维护约束确认 CRD 类型、Controller 和生成物边界。 |

#### 定位源码的命令

```bash
rg -n "type (BatchSandbox|Pool|SandboxSnapshot)(Spec|Status| struct)" kubernetes/apis/sandbox/v1alpha1
```

### 5. BatchSandbox 的多个 Sandbox 是同一个 Pod 吗

区分同一个模板、多个副本和独立运行身份。

#### 本节覆盖的原问题

- BatchSandbox 提供的一组沙箱是不是一样的 Pod？
- 模板一样是不是就等于同一个实例？

#### 核心结论

正确答案是：默认来自同一模板，但运行时是多个独立 Pod。类比是同一张镜像克隆出多台机器，不是多人共享同一台机器。

直接模式下 shardPatches 可以修改某个 index 的环境变量、资源或其他模板字段，因此副本甚至不一定配置相同。

Pool 模式分配的是已经预创建的独立 Pod；请求时的 BatchSandbox shardPatches 不会重新改写这些 Pool Pod。

#### 关键概念

| 概念 | 含义 |
|---|---|
| TEMPLATE SAMENESS | 多个副本可以从同一 PodTemplateSpec 创建，因此初始配置相似。 |
| RUNTIME IDENTITY | 每个 Pod 都有独立 name、UID、IP、调度节点、进程和生命周期，不是同一个 Pod。 |
| SHARD PATCH | 直接模式可按副本索引对模板做 Strategic Merge Patch，使副本故意不同。 |

#### 工作流程

`spec.replicas=N` → `按 index 计算 Pod` → `复制 template` → `可应用 shardPatches[index]` → `创建 N 个独立 Pod`

#### 源码位置

| 路径 | 阅读重点 | 作用 |
|---|---|---|
| [kubernetes/apis/sandbox/v1alpha1/batchsandbox_types.go](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/kubernetes/apis/sandbox/v1alpha1/batchsandbox_types.go) | ShardPatches | replicas、template 与 shardPatches 的公共 schema。 |
| [kubernetes/internal/controller/batchsandbox_controller.go](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/kubernetes/internal/controller/batchsandbox_controller.go) | scaleBatchSandbox | 直接模式按索引扩缩容并应用 shard patch。 |
| [kubernetes/internal/controller/batchsandbox_controller_test.go](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/kubernetes/internal/controller/batchsandbox_controller_test.go) | When create new batch sandbox with ShardPatches | 测试明确验证 heterogeneous pods。 |

#### 定位源码的命令

```bash
rg -n "pod-index|ShardPatches|StrategicMergePatch|scaleBatchSandbox" kubernetes/internal/controller kubernetes/apis/sandbox/v1alpha1
```

### 6. poolRef 与 template 启动有什么区别

理解直接创建、指定 Pool 和 poolRef=* 自动分配三条路径。

#### 本节覆盖的原问题

- poolRef 和 template 启动有什么区别？
- Pool 模式还会按请求模板新建 Pod 吗？

#### 核心结论

Direct：请求来了再创建 Pod，启动路径更直接但要等待调度、拉镜像和容器启动。

Pool：Pod 事先已经 Ready，请求主要完成分配和身份绑定，因此追求低延迟；代价是要维护空闲容量和回收策略。

Pool Pod 的模板来自 Pool.spec.template，不是请求时 BatchSandbox.spec.template。两种字段在 schema 中互斥。

#### 关键概念

| 概念 | 含义 |
|---|---|
| DIRECT MODE | poolRef 为空，BatchSandbox Controller 根据 template 在请求后创建 Pod。 |
| POOLED MODE | poolRef 指定 Pool，Pool Controller 从预热 Pod 中分配现有实例。 |
| AUTO ASSIGN | poolRef=* 表示在同 Namespace 自动选择合适 Pool，再写回具体 Pool 名称。 |

#### 工作流程

`BatchSandbox` → `判断 poolRef` → `空：template → 新 Pod` → `具体值：Pool → 预热 Pod` → `*：选择 Pool → 再分配`

#### 源码位置

| 路径 | 阅读重点 | 作用 |
|---|---|---|
| [kubernetes/internal/controller/strategy/pool_strategy_default.go](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/kubernetes/internal/controller/strategy/pool_strategy_default.go) | IsUsingPool | 最短代码直接定义是否使用 Pool 与 * 自动分配。 |
| [kubernetes/internal/controller/pool_controller.go](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/kubernetes/internal/controller/pool_controller.go) | func (r *PoolReconciler) Reconcile | Pool Reconciler 观察引用自己的 BatchSandbox 并执行分配。 |
| [kubernetes/apis/sandbox/v1alpha1/pool_types.go](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/kubernetes/apis/sandbox/v1alpha1/pool_types.go) | type CapacitySpec | 预热容量、伸缩、更新和回收策略的 schema。 |

#### 定位源码的命令

```bash
rg -n "IsUsingPool|PoolRef == \"\*\"|CapacitySpec|poolRef" kubernetes/internal/controller kubernetes/apis/sandbox/v1alpha1
```

### 7. Pod 怎么变成 SandboxSnapshot，再 Resume

[![OpenSandbox Kubernetes 暂停恢复生命周期：BatchSandbox 状态、SandboxSnapshot 提交结果与重新创建](/images/opensandbox/opensandbox-pause-resume-lifecycle.png)](/images/opensandbox/opensandbox-pause-resume-lifecycle.png)

*图 4：Kubernetes pause/resume Lifecycle。恢复会基于 rootfs 快照重新创建 Pod，不会恢复原进程、内存或网络连接。*


把 pause/resume 理解为 rootfs → OCI 镜像 → 新 Pod，而不是进程休眠。

#### 本节覆盖的原问题

- 一个 Pod 怎么变成 SandboxSnapshot？
- 下次 Resume 是恢复原进程吗？

#### 核心结论

Pause 当前只允许单副本，因为 Snapshot 选择一个源 Pod 并记录其容器镜像。

保存的是文件系统层：安装的软件、写入根文件系统的文件可以进入 OCI 镜像；外部 PVC/volume 仍由各自存储负责。

不会保存运行进程、内存、PTY、TCP 长连接、内存中的 secret 或 bwrap Session。Resume 后是使用新镜像重新启动。

#### 关键概念

| 概念 | 含义 |
|---|---|
| ROOTFS COMMIT | 同节点 commit Job 通过 containerd 把容器可写根文件系统提交并推送成 OCI 镜像。 |
| SNAPSHOT CR | SandboxSnapshot 记录来源 BatchSandbox、源 Pod 与每个容器的 ImageURI/Digest。 |
| RECREATE, NOT CHECKPOINT | Resume 替换 Pod 模板镜像并重新创建运行时，不恢复内存、PID、TCP 连接或原 shell。 |

#### 工作流程

`Server 写 spec.pause=true` → `BatchSandbox → Pausing` → `创建 SandboxSnapshot` → `同节点 commit Job` → `推送 OCI rootfs 镜像` → `删除/释放旧 Pod` → `pause=false` → `模板换 snapshot image` → `创建新 Pod`

#### 源码位置

| 路径 | 阅读重点 | 作用 |
|---|---|---|
| [docs/guides/pause-resume.md](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/docs/guides/pause-resume.md) | How It Works | 用户与运维视角的 pause/resume 主流程和限制。 |
| [kubernetes/internal/controller/batchsandbox_pause_resume.go](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/kubernetes/internal/controller/batchsandbox_pause_resume.go) | handlePause | BatchSandbox 状态机与 SandboxSnapshot Controller 的实现。 |
| [kubernetes/internal/controller/sandboxsnapshot_controller.go](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/kubernetes/internal/controller/sandboxsnapshot_controller.go) | handlePause | BatchSandbox 状态机与 SandboxSnapshot Controller 的实现。 |
| [kubernetes/apis/sandbox/v1alpha1/sandboxsnapshot_types.go](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/kubernetes/apis/sandbox/v1alpha1/sandboxsnapshot_types.go) | type ContainerSnapshot | Snapshot 状态与每容器镜像结果的 schema。 |

#### 定位源码的命令

```bash
rg -n "ContainerSnapshot|ImageURI|create.*Commit|handleResume|replace.*image|replicas.*1" kubernetes/internal/controller kubernetes/apis/sandbox/v1alpha1 docs/guides/pause-resume.md
```

## 阶段 03 · 进入 Sandbox 内部

### 8. Sandbox Pod 里面到底有哪些东西

把 Init Container、主容器进程、Sidecar 与共享 Namespace 分清。

#### 本节覆盖的原问题

- execd 会自动嵌入进去吗？
- 图里的 execd 是不是一个 Container？
- sandbox 是不是 Pod 最初创建的容器？

#### 核心结论

Pod 里的 sandbox 是主容器名字；它运行用户镜像。execd-installer 只是安装阶段容器，结束后不会常驻。

execd 通过共享 emptyDir 进入主容器，然后作为进程启动。它与用户 entrypoint 共享主容器文件系统和进程边界。

Egress 必须持续控制同一个 Pod Network Namespace，所以是常驻 Sidecar，不是一次性 Init Container。

#### 关键概念

| 概念 | 含义 |
|---|---|
| INIT CONTAINER | execd-installer 先运行，把 execd、bootstrap、bwrap 和 native helper 复制到共享 emptyDir，然后退出。 |
| MAIN CONTAINER PROCESS | Sandbox 主容器使用用户镜像，bootstrap 同时启动 execd 与用户 entrypoint；execd 不是额外 Kubernetes Container。 |
| SIDECAR | Egress 是 Pod 中独立容器，持有 NET_ADMIN；同一个 Pod 的容器共享 Network Namespace。 |

#### 工作流程

`Pod 启动` → `execd-installer → emptyDir` → `主容器执行 bootstrap` → `启动 execd + 用户 entrypoint` → `可选 egress sidecar 同时运行`

#### 源码位置

| 路径 | 阅读重点 | 作用 |
|---|---|---|
| [server/opensandbox_server/services/k8s/provider_common.py](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/server/opensandbox_server/services/k8s/provider_common.py) | _build_execd_init_container | 构造 execd Init Container 和名为 sandbox 的主容器。 |
| [server/opensandbox_server/services/k8s/egress_helper.py](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/server/opensandbox_server/services/k8s/egress_helper.py) | apply_egress_to_spec | 把 egress 作为独立 sidecar 追加到 Pod，并分配 NET_ADMIN。 |
| [components/execd/bootstrap.sh](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/components/execd/bootstrap.sh) | EXECD | 主容器中启动 execd 与用户命令的真实脚本。 |

#### 定位源码的命令

```bash
rg -n "execd-installer|name=\"sandbox\"|opensandbox-bin|name.*egress|NET_ADMIN" server/opensandbox_server/services/k8s
```

### 9. opensandbox/execd 镜像里装了什么

理解镜像是安装包，不等于镜像本身会作为长期 Sidecar 运行。

#### 本节覆盖的原问题

- opensandbox/execd 这个镜像里代码是什么？
- 它是怎么嵌入用户镜像的？

#### 核心结论

镜像中主要是 execd Go 二进制、bootstrap.sh、bwrap、opensandbox-session-gate、opensandbox-launcher，以及可选 execd-ebpf 变体。

Kubernetes 的 Init Container 当前只复制 ./execd，不复制 ./execd-ebpf；主容器还显式设置 EXECD=/opt/opensandbox/execd。

因此‘镜像里有 execd-ebpf’不等于默认 Sandbox 已启用 eBPF。要区分打包完成、安装完成和运行启用三个状态。

#### 关键概念

| 概念 | 含义 |
|---|---|
| INSTALLER IMAGE | 镜像携带可执行文件和脚本，由 Init Container 复制到共享卷。 |
| BOOTSTRAP | 主容器 command 被替换为 /opt/opensandbox/bootstrap.sh，它再启动 execd 和原 entrypoint。 |
| BUILD VARIANT | 镜像同时构建普通 execd 与 execd-ebpf，但默认安装链只复制普通 execd。 |

#### 工作流程

`Dockerfile 编译 Go/C/bwrap` → `镜像包含 execd/bootstrap/helpers` → `Init Container cp 到 /opt/opensandbox` → `主容器 bootstrap` → `execd 监听 44772`

#### 源码位置

| 路径 | 阅读重点 | 作用 |
|---|---|---|
| [components/execd/Dockerfile](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/components/execd/Dockerfile) | Build static bubblewrap | 普通 execd、bwrap、session-gate、launcher 与 execd-ebpf 的构建和最终镜像内容。 |
| [components/execd/README.md](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/components/execd/README.md) | Known issue | 明确记录 execd-ebpf 选择尚未端到端接通。 |
| [components/execd/bootstrap.sh](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/components/execd/bootstrap.sh) | EXECD_INIT | 镜像内容被安装后如何启动。 |

#### 定位源码的命令

```bash
rg -n "COPY --from|cp ./execd|EXECD.*opt/opensandbox" components/execd/Dockerfile server/opensandbox_server/services/k8s/provider_common.py components/execd/bootstrap.sh
```

### 10. bwrap 怎么隔离一个 Session

理解一个长期 bwrap+shell 如何创建 Namespace、重建 rootfs 并复用多次 run。

#### 本节覆盖的原问题

- bubblewrap 是什么？
- 它怎么实现 Namespace 隔离？
- 一个 Session 内多次 run 是不是新容器？

#### 核心结论

bwrap 不是 Docker，也不会创建 Kubernetes Container；它是 execd 启动的普通子进程，使用 Linux clone/unshare、mount、pivot_root 和 seccomp 建立子沙箱。

每个 Session 对应一个独立 bwrap 与长期 shell；同一 Session 的 run 串行写入这个 shell，因此复用 Namespace 和文件修改。不同 Session 会创建不同 Namespace 对象。

share_net=true 时不会创建独立 NetNS；cgroup Namespace 只改变 cgroup 路径视图，不创建新的资源限制，进程仍属于 Sandbox 原 cgroup。

#### 关键概念

| 概念 | 含义 |
|---|---|
| LONG-LIVED SHELL | 创建 Session 时启动一个 bwrap 中的 shell；后续 run 写入同一 stdin，并按 marker 读取退出码。 |
| NAMESPACE SET | PID、UTS、IPC、cgroup 总是隔离；Network 和 User Namespace 按选项启用；Mount Namespace 负责独立挂载视图。 |
| FAIL-CLOSED GATE | 用户命令在 execd 验证外部 PID、NetNS 身份并完成必要 pin 之前不会执行。 |

#### 工作流程

`Create Session` → `execd 构造 bwrap argv` → `clone(CLONE_NEW*)` → `mount/tmpfs/overlay/pivot_root` → `session-gate 等待` → `验证身份` → `MarkReady` → `exec shell` → `后续 run 复用 shell`

#### 源码位置

| 路径 | 阅读重点 | 作用 |
|---|---|---|
| [components/execd/pkg/isolation/isolator.go](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/components/execd/pkg/isolation/isolator.go) | WrapWithLifecycle | bwrap 参数、Linux lifecycle 和隔离接口。 |
| [components/execd/pkg/isolation/bwrap.go](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/components/execd/pkg/isolation/bwrap.go) | WrapWithLifecycle | bwrap 参数、Linux lifecycle 和隔离接口。 |
| [components/execd/pkg/isolation/bwrap_linux.go](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/components/execd/pkg/isolation/bwrap_linux.go) | WrapWithLifecycle | bwrap 参数、Linux lifecycle 和隔离接口。 |
| [components/execd/pkg/runtime/isolated_session.go](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/components/execd/pkg/runtime/isolated_session.go) | RunInIsolatedSession | Session 创建长期 shell以及后续 run 写 stdin 的实现。 |
| [components/execd/pkg/runtime/isolated_session_ctrl.go](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/components/execd/pkg/runtime/isolated_session_ctrl.go) | RunInIsolatedSession | Session 创建长期 shell以及后续 run 写 stdin 的实现。 |

#### 定位源码的命令

```bash
rg -n "unshare-|ro-bind|overlay-src|seccomp|die-with-parent|io.WriteString\(stdin" components/execd/pkg/isolation components/execd/pkg/runtime
```

### 11. Session Upper 到底是什么

把 OverlayFS 的 Lower、Upper、Work、Merged 与 SandboxSnapshot 分开。

#### 本节覆盖的原问题

- Session Upper 又是啥？
- 它是不是 Snapshot，能不能恢复进程？

#### 核心结论

Upper 不是‘更高权限’，只是 OverlayFS 术语。原始 app.py 在 Lower；Session 修改后，新内容写入自己的 Upper，Merged 视图优先显示 Upper。

默认 overlay 模式隔离文件变化；rw 模式直接 bind 真实 workspace，不同 Session 可能互相看到修改；ro 模式完全只读。

Kubernetes 当前使用 emptyDir 保存 /var/lib/execd/isolation，因此 Upper 随 Pod 消失，也不保存内存、进程、TCP 或 Namespace。当前 diff/commit 路由存在，但实现仍返回 not implemented。

#### 关键概念

| 概念 | 含义 |
|---|---|
| LOWER | 原始 workspace 只读层，多个 Session 可以共享相同初始文件。 |
| UPPER | 某个 Session 专属可写层，保存新增、修改以及删除 whiteout。 |
| MERGED VIEW | Session 在原 workspace 路径看到的 Lower+Upper 合成结果；Work 目录仅供 OverlayFS 内部使用。 |

#### 工作流程

`创建 overlay Session` → `UpperManager 分配 upper/work` → `bwrap 挂载 Lower+Upper` → `写文件 → copy-up` → `删文件 → whiteout` → `删除 Session → 清理 upper`

#### 源码位置

| 路径 | 阅读重点 | 作用 |
|---|---|---|
| [components/execd/pkg/isolation/upper.go](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/components/execd/pkg/isolation/upper.go) | func (m *UpperManager) Allocate | Upper/Work 分配、用量跟踪、释放与 GC。 |
| [components/execd/pkg/isolation/bwrap.go](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/components/execd/pkg/isolation/bwrap.go) | bwrapWorkspaceSegment | rw、ro、overlay 三种 workspace 挂载参数。 |
| [server/opensandbox_server/services/k8s/batchsandbox_provider.py](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/server/opensandbox_server/services/k8s/batchsandbox_provider.py) | isolation-upper | Kubernetes 将 isolation root 挂载为 Pod 生命周期的 emptyDir。 |

#### 定位源码的命令

```bash
rg -n "UpperDir|WorkDir|WorkspaceOverlay|diff not implemented|commit not implemented|isolation-upper" components/execd server/opensandbox_server/services/k8s
```

### 12. bwrap 创建 Namespace 需要哪些权限

区分搭建阶段的外层权限、User Namespace 范围权限与最终 workload 权限。

#### 本节覆盖的原问题

- Pod 能配置哪些 Linux Capabilities？
- bwrap 创建 Namespace 分配了什么权限？
- 给 Sandbox NET_ADMIN 为什么危险？

#### 核心结论

Mount、pivot_root、Overlay 和多数 Namespace 创建主要依赖 CAP_SYS_ADMIN；配置私有网络可能需要 NET_ADMIN；切任意 UID/GID 需要 root 或 SETUID/SETGID。

setpriv 模式依赖外层容器权限完成 setup，再切到目标 UID/GID。userns 模式创建 CLONE_NEWUSER，获得只在新 User Namespace 管辖范围内有效的 capabilities，不等于宿主机 root。

Linux Capability 可按用途分组：文件 DAC/ownership、身份切换、网络、进程调试、系统管理、审计、BPF/性能观测等。学习时先掌握 SYS_ADMIN、NET_ADMIN、SETUID、SETGID、SYS_PTRACE、BPF、PERFMON。

当前 Kubernetes Provider 为 bwrap setup 增加 SYS_ADMIN，并放开外层 seccomp/AppArmor；这提高了权限上限，所以必须依靠 bwrap、非 root 身份、User Namespace、seccomp 和可信 helper 共同收缩。最终 root Session 的权限仍取决于具体配置，不能只凭 Namespace 断言全部 capabilities 已删除。

#### 关键概念

| 概念 | 含义 |
|---|---|
| CAPABILITY CEILING | Container securityContext 决定进程最多可能拥有的 Linux Capability；CAP_SYS_ADMIN、NET_ADMIN、BPF 等都应最小化。 |
| SETUP VS WORKLOAD | bwrap 先用权限创建 Namespace、mount、Overlay 和 pivot_root，之后再切 UID/GID并执行用户命令。 |
| SECCOMP | Capability 决定某类特权操作是否被授权；seccomp 在更前面按 syscall 允许或拒绝，两者互补。 |

#### 工作流程

`Pod securityContext 给 setup ceiling` → `bwrap 创建隔离环境` → `setpriv 或 userns 建立身份` → `安装 seccomp` → `执行 workload`

#### 源码位置

| 路径 | 阅读重点 | 作用 |
|---|---|---|
| [server/opensandbox_server/services/k8s/provider_common.py](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/server/opensandbox_server/services/k8s/provider_common.py) | if isolation_enabled | 启用 isolation 时给主容器 SYS_ADMIN 和 unconfined 外层 profiles。 |
| [components/execd/pkg/isolation/isolator.go](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/components/execd/pkg/isolation/isolator.go) | UidMode | UID 模式、可用性探测和默认 seccomp denylist。 |
| [components/execd/pkg/isolation/probe.go](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/components/execd/pkg/isolation/probe.go) | UidMode | UID 模式、可用性探测和默认 seccomp denylist。 |
| [components/execd/pkg/isolation/seccomp_gen.go](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/components/execd/pkg/isolation/seccomp_gen.go) | UidMode | UID 模式、可用性探测和默认 seccomp denylist。 |

#### 定位源码的命令

```bash
rg -n "SYS_ADMIN|NET_ADMIN|CAP_SETUID|CAP_SETGID|CAP_BPF|CAP_PERFMON|denylistSyscalls" server components
```

### 13. execd-ebpf 监听哪些 Hook

理解构建期 CO-RE 嵌入、启动期 attach、cgroup 过滤与三类审计事件。

#### 本节覆盖的原问题

- execd-ebpf 怎么集成 eBPF？
- 监听哪些 hook？
- 它能不能替代 Egress 或 seccomp？

#### 核心结论

exec hook：tracepoint sched:sched_process_exec，记录成功 exec 的 PID、PPID、comm、filename；不含完整 argv。

connect hook：tracepoint sock:inet_sock_set_state，只在新状态 TCP_SYN_SENT 时记录目标 IP/端口；不覆盖 UDP、DNS 域名、包内容，也不代表连接成功。

privilege hook：kprobe commit_creds，在 UID/GID 变化或新增 effective capability 时记录。

它观察整个 Sandbox cgroup，包括多个 bwrap Session，但事件只有 sandbox_id 没有 session_id。它是 observation-only，不阻止连接或提权，不能替代 nftables、seccomp、NetworkPolicy 或 bwrap。

启动要求 execd-ebpf、CAP_BPF、CAP_PERFMON、/sys/kernel/btf/vmlinux 和 OPENSANDBOX_ID；当前默认安装链尚未自动选择这个变体。

#### 关键概念

| 概念 | 含义 |
|---|---|
| CO-RE BUILD | clang 将 audit.bpf.c 编译为 BPF 字节码，bpf2go 生成 Go 包并嵌入 execd-ebpf。 |
| KERNEL HOOK | tracepoint/kprobe 在内核事件发生时运行小程序，通过 Ring Buffer 把事件送回 execd-ebpf。 |
| CGROUP SCOPE | 程序比较 bpf_get_current_cgroup_id 与 target_cgroup，只保留整个 Sandbox cgroup 的事件，没有 session_id。 |

#### 工作流程

`audit.bpf.c` → `clang+bpf2go` → `execd-ebpf` → `检查 BTF/capabilities/cgroup` → `attach hooks` → `内核事件` → `ringbuf` → `JSONL audit`

#### 源码位置

| 路径 | 阅读重点 | 作用 |
|---|---|---|
| [components/execd/pkg/ebpf/audit.go](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/components/execd/pkg/ebpf/audit.go) | hooks := []hookDef | 真实 observer、普通构建 stub 与内核 BPF 程序。 |
| [components/execd/pkg/ebpf/audit_stub.go](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/components/execd/pkg/ebpf/audit_stub.go) | hooks := []hookDef | 真实 observer、普通构建 stub 与内核 BPF 程序。 |
| [components/execd/pkg/ebpf/prog/audit.bpf.c](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/components/execd/pkg/ebpf/prog/audit.bpf.c) | hooks := []hookDef | 真实 observer、普通构建 stub 与内核 BPF 程序。 |
| [components/execd/pkg/isolation/config.go](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/components/execd/pkg/isolation/config.go) | type EbpfConfig | ebpf enabled、observe 和 audit_file 配置。 |
| [components/execd/Dockerfile](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/components/execd/Dockerfile) | bpf2go | bpf2go 和 execd-ebpf build tag 的构建链。 |

#### 定位源码的命令

```bash
rg -n "sched_process_exec|inet_sock_set_state|TCP_SYN_SENT|commit_creds|target_cgroup|ringbuf" components/execd/pkg/ebpf
```

## 阶段 04 · Ingress、Egress 与网络内核

### 14. Ingress 与 Egress 是不是 Kubernetes CR

区分网络方向、OpenSandbox 进程、Kubernetes 内置 Ingress 资源和 OpenSandbox 网络策略字段。

#### 本节覆盖的原问题

- Ingress、Egress 是怎么实现的？
- 这里的 ingress 和 egress 是 Kubernetes CR 吗？

#### 核心结论

OpenSandbox Ingress 是独立 Go 反向代理进程。它通过 informer/lister 找 BatchSandbox，读取 endpoint，再把 HTTP/WebSocket 转发过去。

OpenSandbox Egress 是 Pod Sidecar 和 networkPolicy 配置链；没有名为 Egress 的 OpenSandbox CRD。它的公共策略通过生命周期请求与 egress API 表达。

不要把名词方向与 Kubernetes Kind 混为一谈：Ingress 可以泛指入站流量，也可以特指 networking.k8s.io/Ingress；这里的组件名属于前者。

#### 关键概念

| 概念 | 含义 |
|---|---|
| INGRESS DIRECTION | 外部 Client → Gateway/Server Proxy → 指定 Sandbox endpoint。 |
| EGRESS DIRECTION | Sandbox 进程 → DNS/网络策略 → 外部 API、包仓库或互联网。 |
| RESOURCE VS COMPONENT | Kubernetes 有内置 Ingress API，但 OpenSandbox 的 ingress/egress 在这里主要是 Go 组件和 Pod 配置，不是这三个 CRD 中的资源。 |

#### 工作流程

`外部 Host/Header` → `Ingress Proxy` → `Provider 查 BatchSandbox` → `读取 endpoint annotation/status` → `反向代理到 Pod IP:port`

#### 源码位置

| 路径 | 阅读重点 | 作用 |
|---|---|---|
| [components/ingress/main.go](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/components/ingress/main.go) | reverseProxy := proxy.NewProxy | Ingress 组合 provider、反向代理和 HTTP Server。 |
| [components/ingress/pkg/proxy/proxy.go](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/components/ingress/pkg/proxy/proxy.go) | GetEndpoint | 请求路由与 BatchSandbox endpoint 查询。 |
| [components/ingress/pkg/sandbox/batchsandbox_provider.go](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/components/ingress/pkg/sandbox/batchsandbox_provider.go) | GetEndpoint | 请求路由与 BatchSandbox endpoint 查询。 |
| [docs/components/ingress.md](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/docs/components/ingress.md) | Routing | 用户视角的 Host/Header 路由与部署说明。 |

#### 定位源码的命令

```bash
rg -n "NewProxy|GetEndpoint|GetEndpoints|WebSocket|ProviderType" components/ingress
```

### 15. 为什么 Egress 要做成独立 Sidecar

从 Network Namespace、NET_ADMIN 和可信边界理解为什么不能把 nftables 权限交给用户 Sandbox。

#### 本节覆盖的原问题

- OpenSandbox 操作的是主机 nftables 吗？
- 为什么不直接给 sandbox NET_ADMIN？
- egress 是不是另一个 Container？

#### 核心结论

nftables 是 Linux 内核 netfilter 的用户态配置接口。规则不属于某个容器文件系统，而属于执行 nft 命令时进程所在的 Network Namespace。

在 Kubernetes 中 Egress Sidecar 与 sandbox 主容器共享 Pod NetNS，因此规则位于 Pod 网络栈，不是整个节点默认/宿主机 Network Namespace；除非错误地使用 hostNetwork 等配置。

如果把 NET_ADMIN 给用户 Sandbox，用户可直接执行 nft flush/delete、改路由、改 DNS 重定向，策略边界失效。分离 Sidecar 的目的就是让策略执行者与不可信 workload 分权。

Egress 是常驻 Container，因为它要持续代理 DNS、接收策略更新、刷新动态 IP lease 并清理规则；不是一次性安装器。

#### 关键概念

| 概念 | 含义 |
|---|---|
| POD NETNS | 同一 Pod 的主容器与 Egress Sidecar 共享 Network Namespace，因此 Sidecar 写的 OUTPUT 规则同时约束主容器流量。 |
| PRIVILEGE SEPARATION | 主容器显式 drop NET_ADMIN；只有可信 Egress Sidecar持有 NET_ADMIN 并更新 nftables。 |
| ENFORCEMENT OWNERSHIP | 策略执行者必须不受被限制 workload 控制，否则 workload 可以删除规则、自行改 DNS 或放行所有流量。 |

#### 工作流程

`Pod 创建` → `主容器 drop NET_ADMIN` → `egress sidecar add NET_ADMIN` → `共享 Pod NetNS` → `Sidecar 写 nftables OUTPUT` → `用户流量经过同一规则链`

#### 源码位置

| 路径 | 阅读重点 | 作用 |
|---|---|---|
| [server/opensandbox_server/services/k8s/egress_helper.py](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/server/opensandbox_server/services/k8s/egress_helper.py) | build_security_context_for_sandbox_container | 主容器 drop NET_ADMIN 与 egress sidecar add NET_ADMIN 的直接证据。 |
| [docs/architecture/network-isolation.md](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/docs/architecture/network-isolation.md) | Egress | 官方网络隔离架构解释同 Network Namespace 下的权限分离。 |
| [components/egress/main.go](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/components/egress/main.go) | func main | Sidecar 启动 DNS proxy、DNS redirect、nft manager 和 policy server。 |

#### 定位源码的命令

```bash
rg -n "drop.*NET_ADMIN|add.*NET_ADMIN|hook output|table inet opensandbox|sidecar" server/opensandbox_server/services/k8s components/egress docs/architecture/network-isolation.md
```

### 16. DNS、nftables、TTL 与长连接完整链路

[![OpenSandbox Egress 数据流：DNS 重定向、策略合并、DNS Proxy、nftables 与外部服务](/images/opensandbox/opensandbox-egress-dataflow.png)](/images/opensandbox/opensandbox-egress-dataflow.png)

*图 5：Egress Data Flow。DNS 解析结果把域名策略桥接到 nftables 的动态 IP 集合，Pod 出站流量再由内核规则执行。*


把域名策略转换成可执行 IP 规则，并解释 TTL 过期为什么不会直接切断已有 TCP 连接。

#### 本节覆盖的原问题

- Egress 怎么和 DNS、nftables 集成？
- nftables 是什么？
- TTL 到期会不会把长连接断掉？

#### 核心结论

启动时 Sidecar 在 127.0.0.1:15353 监听 DNS，通过 OUTPUT 53 REDIRECT 捕获 Pod 的 UDP/TCP DNS。代理自身向 upstream 查询时设置 mark 或使用 exempt，避免再次被重定向形成递归。

域名被 deny 时直接返回 NXDOMAIN；允许时先得到 upstream 响应，再同步调用 AddResolvedIPs，把 A/AAAA 写进 dyn_allow_v4/v6，最后才把 DNS 答案返回应用，减少应用抢先连接而规则尚未生效的竞态。

nftables 表为 inet opensandbox，output chain 的关键顺序是：established/related accept、mark accept、loopback accept、DoT/DoH 与 deny、动态 allow、静态 allow、最终 default drop/accept。

TTL 不是 nftables 规则整体寿命，而是动态 set 元素 lease。代码使用 clampTTL = DNS TTL + 60 秒，最少 60、最多 360 秒。

已有 TCP 连接通常不会因 lease 过期被切断，因为 ct state established,related 在动态 set 检查前已经 accept。连接 tracker 每 30 秒扫描 /proc/net/tcp{,6}，活动 IP 刷新为 360 秒；连接关闭时再做一次最终刷新，提供有限重连宽限。UDP/QUIC 不在这个 TCP tracker 内，依赖后续 DNS 刷新。

你的最终心智模型应该是：Lifecycle Server 管资源生命周期；Kubernetes Controller 管 CRD→Pod；execd 管 Pod 内执行；bwrap 管 Session 子隔离；eBPF做观察；Ingress 管入站定位；Egress Sidecar 用 DNS+nftables 管出站执行。

#### 关键概念

| 概念 | 含义 |
|---|---|
| DNS-TO-IP BRIDGE | DNS Proxy 先按域名判断，允许后提取 A/AAAA 与 TTL，在把答案返回客户端前写入 nft 动态 allow set。 |
| NFT SET LEASE | 动态 IP 元素带 timeout；当前实现把 DNS TTL 加 60 秒并限制到 60–360 秒。 |
| CONNTRACK CONTINUITY | OUTPUT 链优先接受 established,related；已有 TCP 连接不会只因动态元素到期立即中断，tracker 还会刷新活动远端 IP。 |

#### 工作流程

`应用发 DNS:53` → `iptables/nft REDIRECT → 127.0.0.1:15353` → `DNS Proxy 评估域名` → `允许则查询 upstream` → `提取 A/AAAA+TTL` → `先 AddResolvedIPs` → `再返回 DNS 答案` → `应用连接目标 IP` → `nft OUTPUT allow/drop` → `连接刷新与 conntrack`

#### 源码位置

| 路径 | 阅读重点 | 作用 |
|---|---|---|
| [components/egress/pkg/dnsproxy/proxy.go](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/components/egress/pkg/dnsproxy/proxy.go) | maybeNotifyResolved | DNS 策略判断、上游转发、A/AAAA+TTL 提取以及回调时序。 |
| [components/egress/pkg/dnsproxy/upstream.go](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/components/egress/pkg/dnsproxy/upstream.go) | maybeNotifyResolved | DNS 策略判断、上游转发、A/AAAA+TTL 提取以及回调时序。 |
| [components/egress/pkg/nftables/manager.go](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/components/egress/pkg/nftables/manager.go) | StartConnectionRefresh | 静态规则、动态 timeout、TCP 活动扫描和 lease 刷新。 |
| [components/egress/pkg/nftables/dynamic.go](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/components/egress/pkg/nftables/dynamic.go) | StartConnectionRefresh | 静态规则、动态 timeout、TCP 活动扫描和 lease 刷新。 |
| [components/egress/pkg/nftables/connection_tracker.go](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/components/egress/pkg/nftables/connection_tracker.go) | StartConnectionRefresh | 静态规则、动态 timeout、TCP 活动扫描和 lease 刷新。 |
| [components/egress/pkg/nftables/connections_linux.go](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/components/egress/pkg/nftables/connections_linux.go) | StartConnectionRefresh | 静态规则、动态 timeout、TCP 活动扫描和 lease 刷新。 |
| [components/egress/pkg/iptables/redirect.go](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/components/egress/pkg/iptables/redirect.go) | SetupRedirect | 把 Pod 内 UDP/TCP 53 重定向到本地 DNS Proxy，并用 mark 避免递归。 |
| [components/egress/nft.go](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/components/egress/nft.go) | setupNft | 把 DNS Proxy onResolved 回调接到 nft AddResolvedIPs。 |

#### 定位源码的命令

```bash
rg -n "SetupRedirect|maybeNotifyResolved|AddResolvedIPs|clampTTL|established,related|StartConnectionRefresh" components/egress
```

## 附录 A：Linux Capabilities 速查

Linux 把传统 root 权限拆成一组独立 Capability。Kubernetes 在容器的 `securityContext.capabilities.add/drop` 中配置它们；最终是否可用还受内核、容器运行时、User Namespace、seccomp、AppArmor/SELinux 等共同限制。

| Capability | 主要能力 |
|---|---|
| `CAP_CHOWN` | 修改文件 UID/GID 所有者。 |
| `CAP_DAC_OVERRIDE` | 绕过普通文件读、写、执行权限检查。 |
| `CAP_DAC_READ_SEARCH` | 绕过文件读取和目录搜索权限检查。 |
| `CAP_FOWNER` | 绕过通常要求文件所有者才能执行的操作。 |
| `CAP_FSETID` | 修改文件时保留 setuid/setgid 位。 |
| `CAP_KILL` | 绕过向进程发送信号时的 UID 权限检查。 |
| `CAP_SETGID` | 设置 GID、附加组及相关身份。 |
| `CAP_SETUID` | 设置 UID 及相关身份。 |
| `CAP_SETPCAP` | 修改进程 Capability 集合。 |
| `CAP_SETFCAP` | 设置文件 Capability。 |
| `CAP_LINUX_IMMUTABLE` | 设置 immutable/append-only 文件属性。 |
| `CAP_NET_BIND_SERVICE` | 绑定低端口，通常指小于 1024 的端口。 |
| `CAP_NET_BROADCAST` | 使用 socket broadcast/multicast 的历史能力，实际很少使用。 |
| `CAP_NET_ADMIN` | 配置网卡、路由、防火墙、nftables、流量控制等网络管理操作。 |
| `CAP_NET_RAW` | 使用 RAW/PACKET socket，例如部分 ping、抓包或自定义报文。 |
| `CAP_IPC_LOCK` | 锁定内存，避免被换出，并执行部分大页相关操作。 |
| `CAP_IPC_OWNER` | 绕过 System V IPC 对象权限检查。 |
| `CAP_SYS_MODULE` | 加载、卸载内核模块；风险极高。 |
| `CAP_SYS_RAWIO` | 直接 I/O、访问部分设备或物理内存；风险极高。 |
| `CAP_SYS_CHROOT` | 调用 `chroot`。 |
| `CAP_SYS_PTRACE` | ptrace、读取/修改其他进程及使用 process_vm_*。 |
| `CAP_SYS_PACCT` | 配置进程记账。 |
| `CAP_SYS_ADMIN` | 大量系统管理操作，包括 mount、部分 Namespace、OverlayFS、`pivot_root` 等；范围很广，常被称为“新的 root”。 |
| `CAP_SYS_BOOT` | 重启系统或使用相关系统调用。 |
| `CAP_SYS_NICE` | 调整进程优先级、调度策略和 CPU affinity。 |
| `CAP_SYS_RESOURCE` | 绕过或提高资源限制，操作部分 quota/rlimit。 |
| `CAP_SYS_TIME` | 修改系统时间和硬件时钟。 |
| `CAP_SYS_TTY_CONFIG` | 配置虚拟终端设备。 |
| `CAP_MKNOD` | 使用 `mknod` 创建设备文件。 |
| `CAP_LEASE` | 在文件上建立 lease。 |
| `CAP_AUDIT_WRITE` | 向内核审计日志写记录。 |
| `CAP_AUDIT_CONTROL` | 配置内核审计系统。 |
| `CAP_AUDIT_READ` | 读取内核审计日志。 |
| `CAP_MAC_OVERRIDE` | 覆盖 Linux Security Module 的强制访问控制检查。 |
| `CAP_MAC_ADMIN` | 配置强制访问控制策略。 |
| `CAP_SYSLOG` | 执行特权 syslog 操作和读取受限内核日志。 |
| `CAP_WAKE_ALARM` | 设置能唤醒系统的定时器。 |
| `CAP_BLOCK_SUSPEND` | 阻止系统挂起。 |
| `CAP_PERFMON` | 使用受限性能监控和 perf 事件。 |
| `CAP_BPF` | 执行特权 BPF 操作；新内核从 SYS_ADMIN 中拆出。 |
| `CAP_CHECKPOINT_RESTORE` | 执行 checkpoint/restore 相关操作，例如部分 `clone3`、`/proc/pid/map_files` 访问。 |

OpenSandbox 中最需要记住的是：

- bwrap 搭建挂载、Overlay 和 `pivot_root` 时主要涉及 `CAP_SYS_ADMIN`。
- Egress Sidecar 修改 nftables 时需要 `CAP_NET_ADMIN`。
- 身份切换可能涉及 `CAP_SETUID` 和 `CAP_SETGID`。
- eBPF/性能观测在新内核上可能涉及 `CAP_BPF` 与 `CAP_PERFMON`。
- setup 阶段拥有某个 Capability，不代表最终用户命令一定保留它；必须继续检查 UID 模式、Capability drop、seccomp 和外层容器配置。

Kubernetes 配置示例：

```yaml
securityContext:
  capabilities:
    drop:
      - ALL
    add:
      - NET_BIND_SERVICE
```

## 附录 B：容易混淆的概念

| 容易混淆 | 正确区分 |
|---|---|
| Sandbox 与 Pod | Sandbox 是平台逻辑资源；Kubernetes 后端通常用 Pod 承载。 |
| Pod 与 Container | Pod 是共享网络等 Namespace 的容器集合；主容器、init container、sidecar 都可能属于同一 Pod。 |
| execd 与 execd-installer | installer 是 Init Container；execd 是被复制进主容器后运行的守护进程。 |
| Egress 与 Sandbox 主容器 | Egress 是独立 sidecar，但与主容器共享 Pod Network Namespace。 |
| SandboxSnapshot 与进程 checkpoint | Snapshot 保存 rootfs OCI 镜像，不保存进程内存和网络连接。 |
| Session Upper 与 Snapshot | Upper 是 Session 的临时 Overlay 可写层；Snapshot 是 Kubernetes pause/resume 使用的 OCI rootfs 记录。 |
| bwrap 与 eBPF | bwrap 建立隔离；eBPF 观察内核事件。 |
| Capability 与 seccomp | Capability 判断特权操作是否获授权；seccomp 按 syscall 过滤，二者互补。 |
| DNS TTL 与 TCP 生命周期 | TTL 控制动态 IP lease；已建立 TCP 是否继续由 conntrack 和 nftables 规则顺序决定。 |

## 附录 C：推荐源码阅读顺序

1. [docs/architecture/index.md](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/docs/architecture/index.md)：先看全局架构。
2. [server/opensandbox_server/main.py](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/server/opensandbox_server/main.py)：找到 FastAPI 控制面入口。
3. [server/opensandbox_server/api/lifecycle.py](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/server/opensandbox_server/api/lifecycle.py)：追踪生命周期 API。
4. [kubernetes/apis/sandbox/v1alpha1/batchsandbox_types.go](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/kubernetes/apis/sandbox/v1alpha1/batchsandbox_types.go)、[kubernetes/apis/sandbox/v1alpha1/pool_types.go](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/kubernetes/apis/sandbox/v1alpha1/pool_types.go)、[kubernetes/apis/sandbox/v1alpha1/sandboxsnapshot_types.go](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/kubernetes/apis/sandbox/v1alpha1/sandboxsnapshot_types.go)：理解三个 CRD。
5. [kubernetes/internal/controller/batchsandbox_controller.go](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/kubernetes/internal/controller/batchsandbox_controller.go) 与 [kubernetes/internal/controller/pool_controller.go](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/kubernetes/internal/controller/pool_controller.go)：理解 CRD 如何变成 Pod。
6. [components/execd/main.go](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/components/execd/main.go) 与 [components/execd/pkg/web/router.go](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/components/execd/pkg/web/router.go)：理解 execd 服务入口。
7. [components/execd/pkg/isolation/bwrap.go](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/components/execd/pkg/isolation/bwrap.go)、[components/execd/pkg/runtime/isolated_session.go](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/components/execd/pkg/runtime/isolated_session.go)、[components/execd/pkg/isolation/upper.go](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/components/execd/pkg/isolation/upper.go)：理解 Session 隔离。
8. [components/execd/pkg/ebpf/prog/audit.bpf.c](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/components/execd/pkg/ebpf/prog/audit.bpf.c)：查看三个 eBPF Hook。
9. [components/ingress/main.go](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/components/ingress/main.go)：理解入站路由。
10. [components/egress/main.go](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/components/egress/main.go)、[components/egress/pkg/dnsproxy/proxy.go](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/components/egress/pkg/dnsproxy/proxy.go)、[components/egress/pkg/nftables/manager.go](https://github.com/opensandbox-group/OpenSandbox/blob/865aa52a084a7a0bc8d1f3bb61a6fc8a7dde0482/components/egress/pkg/nftables/manager.go)：理解 DNS 与 nftables 出站链路。

## 结语

可以用一句话总结整个项目：

> OpenSandbox 用 Lifecycle Server 统一管理 Sandbox 生命周期，用 Docker/Kubernetes Provider 落地运行环境，用 execd 与 bwrap 管理沙箱内执行和 Session 子隔离，再用 Ingress/Egress 与 eBPF 分别处理访问、出站控制和安全观测。

这份笔记中的 Kubernetes、Namespace、eBPF 与 nftables 行为主要来自源码和文档验证；没有把“代码表达的设计”冒充成“已经在当前机器实际运行证明的结果”。
