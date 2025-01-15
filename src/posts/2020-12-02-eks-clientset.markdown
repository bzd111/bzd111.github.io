---
layout: post
title: "aws eks 连接使用"
date: "2020-12-02"
tags: ["k8s"]
slug: "2020-12-02-eks-clientset"
---

<!-- vim-markdown-toc Redcarpet -->

* [前言](#前言)
* [aliyun](#aliyun)
* [aws](#aws)
    * [aws 添加集群 kubeconfig](#aws-添加集群-kubeconfig)
    * [认证方式](#认证方式)
        * [bearer token 认证](#bearer-token-认证)
    * [使用 go code 连接 eks](#使用-go-code-连接-eks)
* [Reference](#reference)

<!-- vim-markdown-toc -->

# 前言

aws 的认证方式和 aliyun 的不同，这里稍作记录
aws 使用 AWS IAM credentials
aliyun 采用客户端证书

# aliyun

aliyun 只需要简单的把界面上提供的配置文件复制下来放到~/.kube 下即可
主要信息是证书的公钥和私钥

```
users:
- name: "name"
  user:
    client-certificate-data: ca-data
    client-key-data: key-data

```

# aws

aws 页面上没有提供这样的文件，需要手动获取

## aws 添加集群 kubeconfig

1、安装 awscli，配置权限

`pip install --upgrade awscli` 这里采用简单的 pip 安装，是 v1 版本，推荐安装 v2 版本
`aws configure` 按照提示输入

2、修改 configmap 添加用户

`kubectl edit cm aws-auth -n kube-system` 照葫芦画瓢，添加用户，用户名可以通过`aws sts get-caller-identity` 获取

3、生成 kubeconfig 文件

`aws eks get-token --cluster-name xxxxxx` 执行完这个，配置就出现~/.kube/config 里了

初次看到这个可能有点懵，

```
- name: arn:aws:eks:ap-south-1:620143331427:cluster/yaowei-test-cluster
  user:
    exec:
      apiVersion: client.authentication.k8s.io/v1alpha1
      args:
      - --region
      - ap-south-1
      - eks
      - get-token
      - --cluster-name
      - cluster-name
      command: aws
      env: null
```

## 认证方式

### bearer token 认证

当执行 kubectl 命令时，会执行配置文件中的 command，`aws --region ap-south-1 eks get-token --cluster-name cluster-name`，然后会返回一个 body 里含有 token 和过期时间(14 分钟)。

执行命令时，会使用.aws 里的 AccessKeyId 和 SecretAccessKey，然后通过 aws sts client 加上 cluster name 去请求 token，然后按照以下格式返回。

```json
{
  "kind": "ExecCredential",
  "apiVersion": "client.authentication.k8s.io/v1alpha1",
  "spec": {},
  "status": {
    "expirationTimestamp": "2020-12-02T02:53:59Z",
    "token": "k8s-aws-v1.xxxx"
  }
}
```

然后可以通过 kubectl --token=k8s-aws-v1.xxxx get node 进行访问

## 使用 go code 连接 eks

session 会读取~/.aws 下的配置文件，然后获取 token，放入到 kubeconfig 的配置连接里，方式和 aws 命令获取原理类似，

```golang
package main

import (
	"encoding/base64"
	"log"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"

	"github.com/aws/aws-sdk-go/service/eks"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"

	"sigs.k8s.io/aws-iam-authenticator/pkg/token"
)

func newClientset(cluster *eks.Cluster) (*kubernetes.Clientset, error) {
	gen, err := token.NewGenerator(true, false)
	if err != nil {
		return nil, err
	}
	opts := &token.GetTokenOptions{
		ClusterID: aws.StringValue(cluster.Name),
	}
	tok, err := gen.GetWithOptions(opts)
	if err != nil {
		return nil, err
	}
	ca, err := base64.StdEncoding.DecodeString(aws.StringValue(cluster.CertificateAuthority.Data))
	if err != nil {
		return nil, err
	}
	clientset, err := kubernetes.NewForConfig(
		&rest.Config{
			Host:        aws.StringValue(cluster.Endpoint),
			BearerToken: tok.Token,
			TLSClientConfig: rest.TLSClientConfig{
				CAData: ca,
			},
		},
	)
	if err != nil {
		return nil, err
	}
	return clientset, nil
}

func main() {
	name := "cluster-name"
	region := "ap-south-1"
	sess := session.Must(session.NewSession(&aws.Config{
		Region: aws.String(region),
	}))
	eksSvc := eks.New(sess)

	input := &eks.DescribeClusterInput{
		Name: aws.String(name),
	}
	result, err := eksSvc.DescribeCluster(input)
	if err != nil {
		log.Fatalf("Error calling DescribeCluster: %v", err)
	}
	clientset, err := newClientset(result.Cluster)
	if err != nil {
		log.Fatalf("Error creating clientset: %v", err)
	}
	// nodes, err := clientset.CoreV1().Pods().List(metav1.ListOptions{})
	// label := "app=" + "video-provider"
	label := "app=" + "app-router"
	pods, _ := clientset.CoreV1().Pods("default").List(v1.ListOptions{LabelSelector: label})

	if err != nil {
		log.Fatalf("Error getting EKS nodes: %v", err)
	}
	log.Printf("pods: %v", len(pods.Items))
}

```

go.mod

```
go 1.14
require(
    github.com/aws/aws-sdk-go v1.35.36
    k8s.io/apimachinery v0.17.0
    k8s.io/client-go v0.17.0
    sigs.k8s.io/aws-iam-authenticator v0.5.2
)
```

# Reference

- https://docs.aws.amazon.com/zh_cn/cli/latest/userguide/cli-chap-install.html
- https://kubernetes.io/zh/docs/reference/access-authn-authz/authentication/
- https://github.com/aws/aws-cli/blob/08a7df3ff3/awscli/customizations/eks/get_token.py#L63
- https://github.com/kubernetes-sigs/aws-iam-authenticator
