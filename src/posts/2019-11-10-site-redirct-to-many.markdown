---
layout: post
title: "网站重定向次数过多"
date: "2019-11-10"
tags: ["nginx"]
slug: "2019-11-10-site-redirct-to-many" 
---

<!-- vim-markdown-toc Redcarpet -->

* [前言](#前言)
* [排查](#排查)
* [总结](#总结)

<!-- vim-markdown-toc -->

# 前言

前几天发现，博客打不开了，提示`too many redirects`

# 排查

1、检查 nginx 日志、配置
配置如下：

```conf
server {
	listen 80 ;
	server_name gogogozxc.xyz;
      1 server {
         return      301 https://$server_name$request_uri;
}


server {

    listen 443 ssl http2;
    ssl_certificate         /etc/blog/blog.crt;
    ssl_certificate_key     /etc//blog.key;

    server_name gogogozxc.xyz www.gogogozxc.xyz;

    location  / {
        proxy_pass  http://localhost:4000;

        #Proxy Settings
        proxy_redirect     off;
        proxy_set_header   Host             $host;
        proxy_set_header   X-Real-IP        $remote_addr;
        proxy_set_header   X-Forwarded-For  $proxy_add_x_forwarded_for;
        proxy_next_upstream error timeout invalid_header http_500 http_502 http_503 http_504;
        proxy_max_temp_file_size 0;
        proxy_connect_timeout      90;
        proxy_send_timeout         90;
        proxy_read_timeout         90;
        proxy_buffer_size          4k;
        proxy_buffers              4 32k;
        proxy_busy_buffers_size    64k;
        proxy_temp_file_write_size 64k;
   }
}
```

2、通过 chrome 的检查工具，发现一个奇怪的现象

![cloudflare](/assets/cloudflare.png)
发现都是 `cloudflare`发起的 301 重定向。这里说一下我的搭建方式，域名是在`godaddy`上买的，不用备案比较方便，
DNS 解析在`cloudflare`。

然后我到了 cloudflare 的控制台，把 SSL/TSL 的加密方式改成了 Full，即使用服务器上的自签名证书进行端到端的加密
原先用的是 Flexible，只有浏览器和 cloudflare 之间有加密。
现在已经可以正常访问了。
![ssl](/assets/ssl.jpg)

# 总结

Flexible 与 Full 最大的区别在于，cloudflare 和服务器之间也是有加密的。由于 nginx 配置了证书所以也需要对应 SSL/TSL 的模式。
