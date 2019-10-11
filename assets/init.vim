call plug#begin('~/.local/share/nvim/plugged')
" auto format tool
Plug 'sbdchd/neoformat'

" VIM MARKDOWN RUNTIME FILES
Plug 'plasticboy/vim-markdown'

" markdown toc
Plug 'mzlogin/vim-markdown-toc'

" markdown preview
Plug 'iamcco/markdown-preview.nvim', {'for': 'markdown', 'do': 'cd app & yarn install'}


call plug#end()

""""""""""""""""""""""""""""""" plugin settings """"""""""""""""""""""""""
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

