---
date: "2022-08-16"
slug: "/2020-08-16-virtual-kubelet"
layout: post
title: "virtual-kubelet"
tags: ["virtual-kubelet", "k8s"]
---

<!-- vim-markdown-toc GitLab -->

* [前言](#前言)
* [Kubelet](#kubelet)
* [Virtual Kubelet](#virtual-kubelet)
    * [ECI](#eci)
* [限制](#限制)
* [Reference](#reference)
    * [- https://github.com/virtual-kubelet/alibabacloud-eci/blob/master/eci.go](#-httpsgithubcomvirtual-kubeletalibabacloud-eciblobmasterecigo)

<!-- vim-markdown-toc -->

# 前言

[Azure Container Instances (ACI)]
最近写 Operator 的时候，由于资源问题，需要把 cr 调度到，阿里云的[ECI(Elastic Container Instance)](https://help.aliyun.com/document_detail/89129.html)上，ECI 的底层是使用`Virtual Kubelet`。

这里稍作记录。

# Kubelet

kubelet 作为 Node 上一个重要的组件，调用 CRI，CNI，CSI 来创建相应的 Pod，并定期执行 Probe，那 Virtual Kubelet 是怎么实现的呢。

# Virtual Kubelet

官方定义：Virtual Kubelet is an open-source Kubernetes kubelet implementation that masquerades as a kubelet.

很多云厂商都提供了这个实现，代码都在[这个组织下](https://github.com/virtual-kubelet)

- [Admiralty Multi-Cluster Scheduler](https://github.com/admiraltyio/multicluster-scheduler/blob/master/README.md#readme)
- [Alibaba Cloud Elastic Container Instance (ECI)](https://github.com/admiraltyio/multicluster-scheduler/blob/master/README.md#readme)
- [AWS Fargate](https://github.com/virtual-kubelet/aws-fargate/blob/master/README.md#readme)
- [Azure Batch](https://github.com/virtual-kubelet/azure-batch/blob/master/README.md#readme)
- [Azure Container Instances (ACI)](https://github.com/virtual-kubelet/azure-aci/blob/master/README.md#readme)
- [Elotl Kip](https://github.com/elotl/kip/blob/master/README.md#readme)
- [Kubernetes Container Runtime Interface (CRI)](https://github.com/virtual-kubelet/cri/blob/master/README.md#readme)
- [Huawei Cloud Container Instance (CCI)](https://github.com/virtual-kubelet/huawei-cci/blob/master/README.md#readme)
- [HashiCorp Nomad](https://github.com/virtual-kubelet/nomad/blob/master/README.md#readme)
- [Liqo](https://github.com/liqotech/liqo/blob/master/README.md#readme)
- [OpenStack Zun](https://github.com/virtual-kubelet/openstack-zun/blob/master/README.md#readme)
- [Tencent Games Tensile Kube](https://github.com/virtual-kubelet/tensile-kube/blob/master/README.md#readme)

## ECI

这里重点看下 Aliyun ECI 的开源实现版本。

在 main.go 里，创建 rootCmd，rootCmd 的 RunE func 是 runRootCommand，

```golang

func NewCommand(ctx context.Context, name string, c Opts) *cobra.Command {
	cmd := &cobra.Command{
		Use:   name,
		Short: name + " provides a virtual kubelet interface for your kubernetes cluster.",
		Long: name + ` implements the Kubelet interface with a pluggable
backend implementation allowing users to create kubernetes nodes without running the kubelet.
This allows users to schedule kubernetes workloads on nodes that aren't running Kubernetes.`,
		RunE: func(cmd *cobra.Command, args []string) error {
			return runRootCommand(ctx, c)
		},
	}

	installFlags(cmd.Flags(), &c)
	return cmd
}
```

runRootCommand 创建了，podInformer、secretInformer、configMapInformer、serviceInformer 四个 informer，同时将这四个 informer 传到 manager.NewResourceManager 里

```golang
func runRootCommand(ctx context.Context, c Opts) error {
    ......

	// Create a shared informer factory for Kubernetes pods in the current namespace (if specified) and scheduled to the current node.
	podInformerFactory := kubeinformers.NewSharedInformerFactoryWithOptions(
		client,
		c.InformerResyncPeriod,
		kubeinformers.WithNamespace(c.KubeNamespace),
		kubeinformers.WithTweakListOptions(func(options *metav1.ListOptions) {
			options.FieldSelector = fields.OneTermEqualSelector("spec.nodeName", c.NodeName).String()
		}))
	podInformer := podInformerFactory.Core().V1().Pods()

	// Create another shared informer factory for Kubernetes secrets and configmaps (not subject to any selectors).
	scmInformerFactory := kubeinformers.NewSharedInformerFactoryWithOptions(client, c.InformerResyncPeriod)
	// Create a secret informer and a config map informer so we can pass their listers to the resource manager.
	secretInformer := scmInformerFactory.Core().V1().Secrets()
	configMapInformer := scmInformerFactory.Core().V1().ConfigMaps()
	serviceInformer := scmInformerFactory.Core().V1().Services()

	go podInformerFactory.Start(ctx.Done())
	go scmInformerFactory.Start(ctx.Done())

	rm, err := manager.NewResourceManager(podInformer.Lister(), secretInformer.Lister(), configMapInformer.Lister(), serviceInformer.Lister())

	p, err := alibabacloud.NewECIProvider(
		c.ProviderConfigPath,
		rm,
		c.NodeName,
		c.OperatingSystem,
		os.Getenv("VKUBELET_POD_IP"),
		c.ListenPort,
	)

	var leaseClient v1beta1.LeaseInterface
	if c.EnableNodeLease {
		leaseClient = client.CoordinationV1beta1().Leases(corev1.NamespaceNodeLease)
	}

	pNode := NodeFromProvider(ctx, c.NodeName, taint, p, c.Version)
	nodeRunner, err := node.NewNodeController(
		node.NaiveNodeProvider{},
		pNode,
		client.CoreV1().Nodes(),
		node.WithNodeEnableLeaseV1Beta1(leaseClient, nil),
		node.WithNodeStatusUpdateErrorHandler(func(ctx context.Context, err error) error {
			if !k8serrors.IsNotFound(err) {
				return err
			}

			newNode := pNode.DeepCopy()
			newNode.ResourceVersion = ""
			_, err = client.CoreV1().Nodes().Create(newNode)
			if err != nil {
				return err
			}
		}),
	)

	eb := record.NewBroadcaster()
	eb.StartLogging(log.G(ctx).Infof)
	eb.StartRecordingToSink(&corev1client.EventSinkImpl{Interface: client.CoreV1().Events(c.KubeNamespace)})

	pc, err := node.NewPodController(node.PodControllerConfig{
		PodClient:       client.CoreV1(),
		PodInformer:     podInformer,
		EventRecorder:   eb.NewRecorder(scheme.Scheme, corev1.EventSource{Component: path.Join(pNode.Name, "pod-controller")}),
		Provider:        p,
		SecretLister:    secretInformer.Lister(),
		ConfigMapLister: configMapInformer.Lister(),
		ServiceLister:   serviceInformer.Lister(),
	})

	cancelHTTP, err := setupHTTPServer(ctx, p, apiConfig)
	defer cancelHTTP()

	go func() {
		if err := pc.Run(ctx, c.PodSyncWorkers); err != nil && errors.Cause(err) != context.Canceled {
			log.G(ctx).Fatal(err)
		}
	}()

	go func() {
		if err := nodeRunner.Run(ctx); err != nil {
			log.G(ctx).Fatal(err)
		}
	}()

	<-ctx.Done()
	return nil
}
```

ResourceManager 是一个结构体，属性是 4 个 Lister Interface，针对不对的资源，提供了 4 个相应的 method

```golang
type ResourceManager struct {
	podLister       corev1listers.PodLister
	secretLister    corev1listers.SecretLister
	configMapLister corev1listers.ConfigMapLister
	serviceLister   corev1listers.ServiceLister
}

// GetPods returns a list of all known pods assigned to this virtual node.
func (rm *ResourceManager) GetPods() []*v1.Pod {
	l, err := rm.podLister.List(labels.Everything())
	if err == nil {
		return l
	}
	log.L.Errorf("failed to fetch pods from lister: %v", err)
	return make([]*v1.Pod, 0)
}

// GetConfigMap retrieves the specified config map from the cache.
func (rm *ResourceManager) GetConfigMap(name, namespace string) (*v1.ConfigMap, error) {
	return rm.configMapLister.ConfigMaps(namespace).Get(name)
}

// GetSecret retrieves the specified secret from Kubernetes.
func (rm *ResourceManager) GetSecret(name, namespace string) (*v1.Secret, error) {
	return rm.secretLister.Secrets(namespace).Get(name)
}

// ListServices retrieves the list of services from Kubernetes.
func (rm *ResourceManager) ListServices() ([]*v1.Service, error) {
	return rm.serviceLister.List(labels.Everything())
}

```

NewECIProvider 创建了一个 ECIProvider 的实例，它实现了 virtual-kubelet 的 PodLifecycleHandler Interface，

通过环境变量传入了很多参数，这些参数在阿里云控制台安装 ack-virtual-node 组件，需要填入的，有些是必填，有些是可选的。

rm 就是上文中创建的 ResourceManager，

```golang
// PodLifecycleHandler defines the interface used by the PodController to react
// to new and changed pods scheduled to the node that is being managed.
//
// Errors produced by these methods should implement an interface from
// github.com/virtual-kubelet/virtual-kubelet/errdefs package in order for the
// core logic to be able to understand the type of failure.
type PodLifecycleHandler interface {
	// CreatePod takes a Kubernetes Pod and deploys it within the provider.
	CreatePod(ctx context.Context, pod *corev1.Pod) error

	// UpdatePod takes a Kubernetes Pod and updates it within the provider.
	UpdatePod(ctx context.Context, pod *corev1.Pod) error

	// DeletePod takes a Kubernetes Pod and deletes it from the provider.
	DeletePod(ctx context.Context, pod *corev1.Pod) error

	// GetPod retrieves a pod by name from the provider (can be cached).
	GetPod(ctx context.Context, namespace, name string) (*corev1.Pod, error)

	// GetPodStatus retrieves the status of a pod by name from the provider.
	GetPodStatus(ctx context.Context, namespace, name string) (*corev1.PodStatus, error)

	// GetPods retrieves a list of all pods running on the provider (can be cached).
	GetPods(context.Context) ([]*corev1.Pod, error)
}

func NewECIProvider(config string, rm *manager.ResourceManager, nodeName, operatingSystem string, internalIP string, daemonEndpointPort int32) (*ECIProvider, error) {
	var p ECIProvider
	var err error
	p.resourceManager = rm
	p.clusterName = os.Getenv("ECI_CLUSTER_NAME")
	p.region = os.Getenv("ECI_REGION")
	accessKey  := os.Getenv("ECI_ACCESS_KEY")
	secretKey := os.Getenv("ECI_SECRET_KEY")
	p.secureGroup == os.Getenv("ECI_SECURITY_GROUP")
	p.vSwitch= os.Getenv("ECI_VSWITCH")

	p.eciClient, err = eci.NewClientWithAccessKey(p.region, accessKey, secretKey)
	p.cpu = "1000"
	p.memory = "4Ti"
	p.pods = "1000"

	p.cpu = os.Getenv("ECI_QUOTA_CPU")
	p.memory= os.Getenv("ECI_QUOTA_MEMORY")

	p.pods= os.Getenv("ECI_QUOTA_POD")
	p.operatingSystem = operatingSystem
	p.nodeName = nodeName
	p.internalIP = internalIP
	p.daemonEndpointPort = daemonEndpointPort
	return &p, err
}

```

接下来看下，ECIProvider 是如何实现 PodLifecycleHandler Interface 的

CreatePod 调用 eci 的 CreateContainerGroupRequest 请求，把 pod 转换成 Container Group

DeletePod 调用 eci 的 CreateDescribeContainerGroupsRequest 查询到 ContainerGroup，然后在调用 CreateDeleteContainerGroupRequest 请求

GetPods 调用 eci 的 CreateDescribeContainerGroupsRequest 请求，把 Container Group 转化成 pod

GetPod 调用 GetPods 返回所有 Pod，然后 namespace, name 遍历 filter 对应的 Pod

GetPodStatus 只是返回 GetPod 的 status 部分

它还实现了 GetContainerLogs method，调用 CreateDescribeContainerLogRequest 请求取回日志

请求阿里云相关的代码，都在 eci 目录下。

```golang
// 	CreatePod(ctx context.Context, pod *corev1.Pod) error
// 解析Pod, 组装CreateContainerGroupRequest，这两个struct和Pod里定义非常相似。
type CreateContainerGroupRequest struct {
	*requests.RpcRequest
	Containers               []CreateContainer         `position:"Query" name:"Container"  type:"Repeated"`
	InitContainers           []CreateContainer         `position:"Query" name:"InitContainer"  type:"Repeated"`
	ResourceOwnerId          requests.Integer          `position:"Query" name:"ResourceOwnerId"`
	SecurityGroupId          string                    `position:"Query" name:"SecurityGroupId"`
	ImageRegistryCredentials []ImageRegistryCredential `position:"Query" name:"ImageRegistryCredential"  type:"Repeated"`
	Tags                     []Tag                     `position:"Query" name:"Tag"  type:"Repeated"`
	ResourceOwnerAccount     string                    `position:"Query" name:"ResourceOwnerAccount"`
	RestartPolicy            string                    `position:"Query" name:"RestartPolicy"`
	OwnerAccount             string                    `position:"Query" name:"OwnerAccount"`
	OwnerId                  requests.Integer          `position:"Query" name:"OwnerId"`
	VSwitchId                string                    `position:"Query" name:"VSwitchId"`
	Volumes                  []Volume                  `position:"Query" name:"Volume"  type:"Repeated"`
	ContainerGroupName       string                    `position:"Query" name:"ContainerGroupName"`
	ZoneId                   string                    `position:"Query" name:"ZoneId"`
}

type CreateContainer struct {
	Name            string           `name:"Name"`
	Image           string           `name:"Image"`
	Memory          requests.Float   `name:"Memory"`
	Cpu             requests.Float   `name:"Cpu"`
	WorkingDir      string           `name:"WorkingDir"`
	ImagePullPolicy string           `name:"ImagePullPolicy"`
	Commands        []string         `name:"Command"  type:"Repeated"`
	Args            []string         `name:"Arg"  type:"Repeated"`
	VolumeMounts    []VolumeMount    `name:"VolumeMount"  type:"Repeated"`
	Ports           []ContainerPort  `name:"Port"  type:"Repeated"`
	EnvironmentVars []EnvironmentVar `name:"EnvironmentVar"  type:"Repeated"`
}

func (p *ECIProvider) CreatePod(ctx context.Context, pod *v1.Pod) error {
	//Ignore daemonSet Pod
	request := eci.CreateCreateContainerGroupRequest()
	request.RestartPolicy = string(pod.Spec.RestartPolicy)

	containers, err := p.getContainers(pod, false)
	initContainers, err := p.getContainers(pod, true)

	// get registry creds
	creds, err := p.getImagePullSecrets(pod)

	// get volumes
	volumes, err := p.getVolumes(pod)

	// assign all the things
	request.Containers = containers
	request.InitContainers = initContainers
	request.Volumes = volumes
	request.ImageRegistryCredentials = creds
	CreationTimestamp := pod.CreationTimestamp.UTC().Format(podTagTimeFormat)
	tags := []eci.Tag{
		eci.Tag{Key: "ClusterName", Value: p.clusterName},
		eci.Tag{Key: "NodeName", Value: p.nodeName},
		eci.Tag{Key: "NameSpace", Value: pod.Namespace},
		eci.Tag{Key: "PodName", Value: pod.Name},
		eci.Tag{Key: "UID", Value: string(pod.UID)},
		eci.Tag{Key: "CreationTimestamp", Value: CreationTimestamp},
	}

	ContainerGroupName := containerGroupName(pod)
	request.Tags = tags
	request.SecurityGroupId = p.secureGroup
	request.VSwitchId = p.vSwitch
	request.ContainerGroupName = ContainerGroupName
	msg := fmt.Sprintf("CreateContainerGroup request %+v", request)
	response, err := p.eciClient.CreateContainerGroup(request)
	msg = fmt.Sprintf("CreateContainerGroup successed. %s, %s, %s", response.RequestId, response.ContainerGroupId, ContainerGroupName)
	return nil
}

// UpdatePod 没有实现
func (p *ECIProvider) UpdatePod(ctx context.Context, pod *v1.Pod) error {
	return nil
}

// DeletePod deletes the specified pod out of ECI.
func (p *ECIProvider) DeletePod(ctx context.Context, pod *v1.Pod) error {
	eciId := ""
	for _, cg := range p.GetCgs() {
		if getECITagValue(&cg, "PodName") == pod.Name && getECITagValue(&cg, "NameSpace") == pod.Namespace {
			eciId = cg.ContainerGroupId
			break
		}
	}
	if eciId == "" {
		return errdefs.NotFoundf("DeletePod can't find Pod %s-%s", pod.Namespace, pod.Name)
	}

	request := eci.CreateDeleteContainerGroupRequest()
	request.ContainerGroupId = eciId
	_, err := p.eciClient.DeleteContainerGroup(request)
	return wrapError(err)
}

// GetPod returns a pod by name that is running inside ECI
// returns nil if a pod by that name is not found.
func (p *ECIProvider) GetPod(ctx context.Context, namespace, name string) (*v1.Pod, error) {
	pods, err := p.GetPods(ctx)
	if err != nil {
		return nil, err
	}
	for _, pod := range pods {
		if pod.Name == name && pod.Namespace == namespace {
			return pod, nil
		}
	}
	return nil, nil
}


```

接着实例化了一个 node.NewNodeController，并且通过 goroutine 启动起来

NodeFromProvider 定义 v1.Node 结构体，

```golang
func NodeFromProvider(ctx context.Context, name string, taint *v1.Taint, p providers.Provider, version string) *v1.Node {
	taints := make([]v1.Taint, 0)

	if taint != nil {
		taints = append(taints, *taint)
	}

	node := &v1.Node{
		ObjectMeta: metav1.ObjectMeta{
			Name: name,
			Labels: map[string]string{
				"type":                   "virtual-kubelet",
				"kubernetes.io/role":     "agent",
				"beta.kubernetes.io/os":  strings.ToLower(p.OperatingSystem()),
				"kubernetes.io/hostname": name,
				"alpha.service-controller.kubernetes.io/exclude-balancer": "true",
			},
		},
		Spec: v1.NodeSpec{
			Taints: taints,
		},
		Status: v1.NodeStatus{
			NodeInfo: v1.NodeSystemInfo{
				OperatingSystem: p.OperatingSystem(),
				Architecture:    "amd64",
				KubeletVersion:  version,
			},
			Capacity:        p.Capacity(ctx),
			Allocatable:     p.Capacity(ctx),
			Conditions:      p.NodeConditions(ctx),
			Addresses:       p.NodeAddresses(ctx),
			DaemonEndpoints: *p.NodeDaemonEndpoints(ctx),
		},
	}
	return node
}
pNode := NodeFromProvider(ctx, c.NodeName, taint, p, c.Version)



nodeRunner, err := node.NewNodeController(
    node.NaiveNodeProvider{},
    pNode,
    client.CoreV1().Nodes(),
    node.WithNodeEnableLeaseV1Beta1(leaseClient, nil),
    node.WithNodeStatusUpdateErrorHandler(func(ctx context.Context, err error) error {
        if !k8serrors.IsNotFound(err) {
            return err
        }

        log.G(ctx).Debug("node not found")
        newNode := pNode.DeepCopy()
        newNode.ResourceVersion = ""
        _, err = client.CoreV1().Nodes().Create(newNode)
        if err != nil {
            return err
        }
        log.G(ctx).Debug("created new node")
        return nil
    }),
)

go func() {
    if err := nodeRunner.Run(ctx); err != nil {
        log.G(ctx).Fatal(err)
    }
}()

// 定义了两个Interval，pingInterval statusInterval，下面control会用到
func (n *NodeController) Run(ctx context.Context) error {
	if n.pingInterval == time.Duration(0) {
		n.pingInterval = DefaultPingInterval
	}
	if n.statusInterval == time.Duration(0) {
		n.statusInterval = DefaultStatusUpdateInterval
	}

	n.chStatusUpdate = make(chan *corev1.Node)
	n.p.NotifyNodeStatus(ctx, func(node *corev1.Node) {
		n.chStatusUpdate <- node
	})

	if err := n.ensureNode(ctx); err != nil {
		return err
	}

	if n.leases == nil {
		n.disableLease = true
		return n.controlLoop(ctx)
	}

	n.lease = newLease(n.lease)
	setLeaseAttrs(n.lease, n.n, n.pingInterval*5)

	l, err := ensureLease(ctx, n.leases, n.lease)
	n.lease = l

	return n.controlLoop(ctx)
}

// 最终是执行的controlLoop，如果k8s支持node lease直接更新lease，否则就更新node status
func (n *NodeController) controlLoop(ctx context.Context) error {
	pingTimer := time.NewTimer(n.pingInterval)
	defer pingTimer.Stop()

	statusTimer := time.NewTimer(n.statusInterval)
	defer statusTimer.Stop()
	if n.disableLease {
		// hack to make sure this channel always blocks since we won't be using it
		if !statusTimer.Stop() {
			<-statusTimer.C
		}
	}

	close(n.chReady)

	for {
		select {
		case <-ctx.Done():
			return nil
		case updated := <-n.chStatusUpdate:
			var t *time.Timer
			if n.disableLease {
				t = pingTimer
			} else {
				t = statusTimer
			}

			log.G(ctx).Debug("Received node status update")
			// Performing a status update so stop/reset the status update timer in this
			// branch otherwise there could be an uneccessary status update.
			if !t.Stop() {
				<-t.C
			}

			n.n.Status = updated.Status
			if err := n.updateStatus(ctx, false); err != nil {
				log.G(ctx).WithError(err).Error("Error handling node status update")
			}
			t.Reset(n.statusInterval)
		case <-statusTimer.C:
			if err := n.updateStatus(ctx, false); err != nil {
				log.G(ctx).WithError(err).Error("Error handling node status update")
			}
			statusTimer.Reset(n.statusInterval)
		case <-pingTimer.C:
			if err := n.handlePing(ctx); err != nil {
				log.G(ctx).WithError(err).Error("Error while handling node ping")
			} else {
				log.G(ctx).Debug("Successful node ping")
			}
			pingTimer.Reset(n.pingInterval)
		}
	}
}

```

然后又启动了一个 PodController，然后把它 Run 起来了。

然后创建了两个 Queue，分别用来 controller Pod 和 PodStatus，重点看下 Pod Queue

AddEventHandler 把 AddFunc/UpdateFunc/DeleteFunc，放入到 queue 里，然后通过 runWorker 去消费，真正消费的函数是 syncHandler

deletePod 会调用 pc.provider.DeletePod 去删除

pc.createOrUpdatePod 会调用 pc.provider.GetPod 判断有没有 pod，没有的话创建，有的话就更新

```golang
pc, err := node.NewPodController(node.PodControllerConfig{
    PodClient:       client.CoreV1(),
    PodInformer:     podInformer,
    EventRecorder:   eb.NewRecorder(scheme.Scheme, corev1.EventSource{Component: path.Join(pNode.Name, "pod-controller")}),
    Provider:        p,
    SecretLister:    secretInformer.Lister(),
    ConfigMapLister: configMapInformer.Lister(),
    ServiceLister:   serviceInformer.Lister(),
})

if err := pc.Run(ctx, c.PodSyncWorkers); err != nil && errors.Cause(err) != context.Canceled {
        log.G(ctx).Fatal(err)
}

func (pc *PodController) Run(ctx context.Context, podSyncWorkers int) error {
    k8sQ := workqueue.NewNamedRateLimitingQueue(workqueue.DefaultControllerRateLimiter(), "syncPodsFromKubernetes")
	defer k8sQ.ShutDown()

	podStatusQueue := workqueue.NewNamedRateLimitingQueue(workqueue.DefaultControllerRateLimiter(), "syncPodStatusFromProvider")
	pc.runProviderSyncWorkers(ctx, podStatusQueue, podSyncWorkers)
	pc.runSyncFromProvider(ctx, podStatusQueue)
	defer podStatusQueue.ShutDown()

	// Set up event handlers for when Pod resources change.
	pc.podsInformer.Informer().AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc: func(pod interface{}) {
			if key, err := cache.MetaNamespaceKeyFunc(pod); err != nil {
				log.L.Error(err)
			} else {
				k8sQ.AddRateLimited(key)
			}
		},
		UpdateFunc: func(oldObj, newObj interface{}) {
			oldPod := oldObj.(*corev1.Pod).DeepCopy()
			newPod := newObj.(*corev1.Pod).DeepCopy()
			newPod.ResourceVersion = oldPod.ResourceVersion
			if reflect.DeepEqual(oldPod.ObjectMeta, newPod.ObjectMeta) && reflect.DeepEqual(oldPod.Spec, newPod.Spec) {
				return
			}
			// At this point we know that something in .metadata or .spec has changed, so we must proceed to sync the pod.
				k8sQ.AddRateLimited(key)
		},
		DeleteFunc: func(pod interface{}) {
			if key, err := cache.DeletionHandlingMetaNamespaceKeyFunc(pod); err != nil {
				log.L.Error(err)
			} else {
				k8sQ.AddRateLimited(key)
			}
		},
	})

	pc.deleteDanglingPods(ctx, podSyncWorkers)

	for id := 0; id < podSyncWorkers; id++ {
		go wait.Until(func() {
			// Use the worker's "index" as its ID so we can use it for tracing.
			pc.runWorker(ctx, strconv.Itoa(id), k8sQ)
		}, time.Second, ctx.Done())
	}

	close(pc.ready)

	<-ctx.Done()

	return nil
}

func (pc *PodController) runWorker(ctx context.Context, workerId string, q workqueue.RateLimitingInterface) {
	for pc.processNextWorkItem(ctx, workerId, q) {
	}
}

func (pc *PodController) processNextWorkItem(ctx context.Context, workerId string, q workqueue.RateLimitingInterface) bool {
	return handleQueueItem(ctx, q, pc.syncHandler)
}

func (pc *PodController) syncHandler(ctx context.Context, key string) error {
	ctx = span.WithField(ctx, "key", key)

	namespace, name, err := cache.SplitMetaNamespaceKey(key)
	// Get the Pod resource with this namespace/name.
	pod, err := pc.podsLister.Pods(namespace).Get(name)
	if err != nil {
		if !errors.IsNotFound(err) {
			err := pkgerrors.Wrapf(err, "failed to fetch pod with key %q from lister", key)
			span.SetStatus(err)
			return err
		}
		// At this point we know the Pod resource doesn't exist, which most probably means it was deleted.
		// Hence, we must delete it from the provider if it still exists there.
		if err := pc.deletePod(ctx, namespace, name); err != nil {
			err := pkgerrors.Wrapf(err, "failed to delete pod %q in the provider", loggablePodNameFromCoordinates(namespace, name))
			span.SetStatus(err)
			return err
		}
		return nil
	}
	// At this point we know the Pod resource has either been created or updated (which includes being marked for deletion).
	return pc.syncPodInProvider(ctx, pod)
}

func (pc *PodController) syncPodInProvider(ctx context.Context, pod *corev1.Pod) error {
	ctx, span := trace.StartSpan(ctx, "syncPodInProvider")
	defer span.End()

	// Add the pod's attributes to the current span.
	ctx = addPodAttributes(ctx, span, pod)

	// Check whether the pod has been marked for deletion.
	// If it does, guarantee it is deleted in the provider and Kubernetes.
	if pod.DeletionTimestamp != nil {
		if err := pc.deletePod(ctx, pod.Namespace, pod.Name); err != nil {
			err := pkgerrors.Wrapf(err, "failed to delete pod %q in the provider", loggablePodName(pod))
			span.SetStatus(err)
			return err
		}
		return nil
	}

	// Ignore the pod if it is in the "Failed" or "Succeeded" state.
	if pod.Status.Phase == corev1.PodFailed || pod.Status.Phase == corev1.PodSucceeded {
		log.G(ctx).Warnf("skipping sync of pod %q in %q phase", loggablePodName(pod), pod.Status.Phase)
		return nil
	}

	// Create or update the pod in the provider.
	if err := pc.createOrUpdatePod(ctx, pod); err != nil {
		err := pkgerrors.Wrapf(err, "failed to sync pod %q in the provider", loggablePodName(pod))
		span.SetStatus(err)
		return err
	}
	return nil
}
```

启动一个 HTTPServer

```golang
cancelHTTP, err := setupHTTPServer(ctx, p, apiConfig)
if err != nil {
    return err
}
defer cancelHTTP()

// 其中pod的handler，获取运行的pod、获取容器日志、执行命令
func PodHandler(p PodHandlerConfig, debug bool) http.Handler {
	r := mux.NewRouter()

	// This matches the behaviour in the reference kubelet
	r.StrictSlash(true)
	if debug {
		r.HandleFunc("/runningpods/", HandleRunningPods(p.GetPods)).Methods("GET")
	}
	r.HandleFunc("/containerLogs/{namespace}/{pod}/{container}", HandleContainerLogs(p.GetContainerLogs)).Methods("GET")
	r.HandleFunc("/exec/{namespace}/{pod}/{container}", HandleContainerExec(p.RunInContainer)).Methods("POST")
	r.NotFoundHandler = http.HandlerFunc(NotFound)
	return r
}

// PodStatsSummaryHandler 提供了/stats/summary，用于获取pod 的status，这是kubelet提供的一个能力。
func PodStatsSummaryHandler(f PodStatsSummaryHandlerFunc) http.Handler {
	if f == nil {
		return http.HandlerFunc(NotImplemented)
	}

	r := mux.NewRouter()

	const summaryRoute = "/stats/summary"
	h := HandlePodStatsSummary(f)

	r.Handle(summaryRoute, ochttp.WithRouteTag(h, "PodStatsSummaryHandler")).Methods("GET")
	r.Handle(summaryRoute+"/", ochttp.WithRouteTag(h, "PodStatsSummaryHandler")).Methods("GET")

	r.NotFoundHandler = http.HandlerFunc(NotFound)
	return r
}
```

# 限制

1. 不支持 DaemonSet，比如说日志采集的 fluentd
2. 不支持 HostPath 的挂载
3. 不支持 HostNetwork
4. 不支持 NodePort 的 Service

# Reference

- https://virtual-kubelet.io/
- https://github.com/virtual-kubelet/virtual-kubelet
- https://github.com/virtual-kubelet/aws-fargate/blob/master/provider.go
- https://github.com/virtual-kubelet/nomad/blob/master/nomad.go
- https://github.com/virtual-kubelet/alibabacloud-eci/blob/master/eci.go
-
