const path = require("path");

exports.createPages = async ({ graphql, actions }) => {
  const { createPage } = actions;

  // 查询所有 Markdown 文件
  const result = await graphql(`
    query {
      allMarkdownRemark {
        edges {
          node {
            id
            frontmatter {
              title
              date
              tags
            }
            fields {
              slug
            }
          }
        }
      }
    }
  `);

  if (result.errors) {
    throw result.errors;
  }

  // 创建分页页面
  const posts = result.data.allMarkdownRemark.edges;
  const postsPerPage = 10;
  const numPages = Math.ceil(posts.length / postsPerPage);

  Array.from({ length: numPages }).forEach((_, i) => {
    createPage({
      path: i === 0 ? `/blog` : `/blog/${i + 1}`,
      component: path.resolve("./src/templates/blog-list.js"),
      context: {
        limit: postsPerPage,
        skip: i * postsPerPage,
        numPages,
        currentPage: i + 1,
      },
    });
  });

  // 为每篇博客文章创建页面
  posts.forEach(({ node }) => {
    createPage({
      path: node.fields.slug,
      component: path.resolve("./src/templates/blog-post.js"),
      context: {
        slug: node.fields.slug,
      },
    });
  });

  // 获取所有标签
  const tags = result.data.allMarkdownRemark.edges.reduce((acc, { node }) => {
    if (node.frontmatter.tags) {
      node.frontmatter.tags.forEach((tag) => {
        if (!acc.includes(tag)) {
          acc.push(tag);
        }
      });
    }
    return acc;
  }, []);

  // 为每个标签创建页面
  tags.forEach((tag) => {
    createPage({
      path: `/tags/${tag}/`, // 标签页面的路径
      component: path.resolve("./src/templates/tags.js"), // 标签页面的模板
      context: {
        tag, // 将标签传递给模板
      },
    });
  });
};

exports.onCreateNode = ({ node, actions }) => {
  const { createNodeField } = actions;

  // 为每篇博客文章生成 slug
  if (node.internal.type === "MarkdownRemark") {
    const slug = `/` + path.basename(node.fileAbsolutePath, ".md"); // 生成 `/second-post`
    createNodeField({
      node,
      name: "slug",
      value: slug,
    });
  }
};
