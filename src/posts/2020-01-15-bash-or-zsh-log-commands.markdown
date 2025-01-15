---
layout: post
title: "bash、zsh记录shell命令"
date: "2020-01-15"
tags: ["shell"]
slug: "2020-01-15-bash-or-zsh-log-commands"
---

<!-- vim-markdown-toc Redcarpet -->

- [前言](#前言)
- [操作](#操作)
- [原理](#原理)
- [总结](#总结)
- [Reference](#reference)

<!-- vim-markdown-toc -->

# 前言

在推上看到一篇文章[sending bash and zsh commands to syslog](http://18pct.com/sending-bash-and-zsh-commands-to-syslog/)，遂动手实践下，发现有点问题，特此记录。

# 操作

1、在/etc/rsyslog.d 文件夹下，新建 commands.conf，内容如下

```conf
local6.*    /var/log/commands.log
```

2、重启 rsyslog，`systemctl restart rsyslog`

3、创建/var/log/commands.log

`touch /var/log/commands.log`

4、添加日志发送命令到对应文件

.bashrc 或/etc/bashrc

```conf
export PROMPT_COMMAND='RETRN_VAL=$?;logger -p local6.debug "$(whoami) [$$]: $(history 1 | sed "s/^[ ]*[0-9]\+[ ]*//" ) [$RETRN_VAL]"'
```

.zshrc 或/etc/bashrc

```conf
precmd() { eval 'RETRN_VAL=$?;logger -p local6.debug "$(whoami) [$$]: $(history | tail -n1 | sed "s/^[ ]*[0-9]\+[ ]*//" ) [$RETRN_VAL]"' }

```

# 原理

通过 bash 的[PROMPT_COMMAND](http://www.tldp.org/HOWTO/Bash-Prompt-HOWTO/x264.html)和 zsh 的[precmd](http://zsh.sourceforge.net/Doc/Release/Functions.html)，在 shell 输入命令时，执行 logger 命令，将信息发送给 local6(用户自定义消息)，然后通过 commands.conf 的配置，把消息发送到/var/log/commands.log

# 总结

这样就可以无感的记录操作历史了

# Reference

1、http://18pct.com/sending-bash-and-zsh-commands-to-syslog/
