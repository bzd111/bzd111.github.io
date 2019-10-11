---
layout: post
title: "vim编写markdown文件"
---

<!-- vim-markdown-toc Redcarpet -->

* [前言](#前言)
* [安装 neovim](#安装-neovim)
* [安装对应插件与配置](#安装对应插件与配置)
    * [插件](#插件)
    * [配置](#配置)
* [上手体验](#上手体验)
    * [现在来看看预览页面](#现在来看看预览页面)

<!-- vim-markdown-toc -->

# 前言

由于最近开通了 Blog，所以要写文章，由于 Blog 是部署在服务器上的，所以用 vim 写，比较方便

# 安装 neovim

`brew install neovim`
其他系统可以看[官方文档](https://github.com/neovim/neovim/wiki/Installing-Neovim)

# 安装对应插件与配置

## 插件

```
" auto format tool
Plug 'sbdchd/neoformat'

" VIM MARKDOWN RUNTIME FILES
Plug 'plasticboy/vim-markdown'

" markdown toc
Plug 'mzlogin/vim-markdown-toc'

" markdown preview
Plug 'iamcco/markdown-preview.nvim', { 'do': { -> mkdp#util#install() } }

```

## 配置

```
" plasticboy/vim-markdown
let g:vim_markdown_conceal = 0
let g:vim_markdown_toc_autofit = 1
let g:vim_markdown_emphasis_multiline = 0
let g:vim_markdown_fenced_languages = ['python', 'js=javascript', 'viml=vim', 'bash=sh', 'golang=go']
let g:vim_markdown_frontmatter = 1
let g:vim_markdown_new_list_item_indent = 2
let g:vim_markdown_folding_disabled = 1
let g:vim_markdown_conceal_code_blocks = 0

" sbdchd/neoformat
let g:neoformat_enabled_markdown = ['prettier']
augroup fmt
  autocmd!
  autocmd BufWritePre * undojoin | Neoformat
augroup END

```

注：neoformat 自动格式化的需要安装 prettier，这个对前端的同学肯定不陌生。
安装方法`npm install --global prettier`，需要安装 npm，
macos 可以使用`brew install node`会自动安装 npm

# 上手体验

在 Command 模式下
输入 GenTocRedcarpet 生成 TOC 标题汇总

输入 MarkdownPreview 打开预览界面

退出时，自动保存

## 现在来看看预览页面

![preview](/assert/markdown-preview.jpg)
