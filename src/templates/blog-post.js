import React, { useEffect } from "react";
import { graphql } from "gatsby";
import Layout from "../components/layout";
import Footer from "../components/Footer";

const BlogPost = ({ data }) => {
  const post = data.markdownRemark;
  // if (!post.frontmatter.date) {
  //     return null;
  // }
  const toc = post.tableOfContents;

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://giscus.app/client.js';
    script.setAttribute('data-repo', 'bzd111/blog-discussions');
    script.setAttribute('data-repo-id', 'R_kgDOPq_S5A');
    script.setAttribute('data-category', 'Announcements');
    script.setAttribute('data-category-id', 'DIC_kwDOPq_S5M4CvDWJ');
    script.setAttribute('data-mapping', 'pathname');
    script.setAttribute('data-strict', '1');
    script.setAttribute('data-reactions-enabled', '1');
    script.setAttribute('data-emit-metadata', '0');
    script.setAttribute('data-input-position', 'bottom');
    script.setAttribute('data-theme', 'light');
    script.setAttribute('data-lang', 'zh-CN');
    script.crossOrigin = 'anonymous';
    script.async = true;

    const giscusContainer = document.querySelector('.giscus');
    if (giscusContainer) {
      giscusContainer.appendChild(script);
    }

    return () => {
      // Cleanup function to remove the script when component unmounts
      if (giscusContainer) {
        giscusContainer.innerHTML = '';
      }
    };
  }, []);

  return (
    <div>
      <Layout />
      <div
        className="max-w-7xl mx-auto px-4 py-8 relative"
        style={{ paddingTop: "6rem", marginTop: "-6rem" }}
      >
        {/* Main Content */}
        <div className="max-w-4xl mx-auto" style={{ scrollMarginTop: "6rem" }}>
          <h1 className="text-4xl font-bold mb-4">{post.frontmatter.title}</h1>
          <div className="prose prose-lg max-w-none">
            <div
              dangerouslySetInnerHTML={{
                __html: post.html
                  .replace(/\\n/g, "")
                  .replace(
                    /<h1(?!.*?class=)/g,
                    '<h1 class="text-4xl font-bold mb-4 scroll-mt-32"'
                  )
                  .replace(
                    /<h1 class="([^"]*)"/g,
                    '<h1 class="$1 text-4xl font-bold mb-4 scroll-mt-32"'
                  )
                  .replace(
                    /<h2(?!.*?class=)/g,
                    '<h2 class="text-3xl font-bold mb-3 scroll-mt-32"'
                  )
                  .replace(
                    /<h2 class="([^"]*)"/g,
                    '<h2 class="$1 text-3xl font-bold mb-3 scroll-mt-32"'
                  )
                  .replace(
                    /<h3(?!.*?class=)/g,
                    '<h3 class="text-2xl font-bold mb-2 scroll-mt-32"'
                  )
                  .replace(
                    /<h3 class="([^"]*)"/g,
                    '<h3 class="$1 text-2xl font-bold mb-2 scroll-mt-32"'
                  ),
              }}
            />
          </div>
        </div>

        {/* Giscus Comments */}
        <div className="max-w-4xl mx-auto mt-8">
          <div className="giscus"></div>
        </div>

        {/* TOC Sidebar */}
        {toc && (
          <div className="hidden lg:block fixed left-4 top-32 w-64">
            <div
              className="bg-white p-4 rounded-lg shadow-lg"
              style={{ maxHeight: "calc(100vh - 12rem)", overflowY: "auto" }}
            >
              <h3 className="font-bold mb-2 text-left">目录: </h3>
              <div
                className="text-left"
                dangerouslySetInnerHTML={{ __html: toc }}
              />
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export const query = graphql`
  query ($slug: String!) {
    markdownRemark(fields: { slug: { eq: $slug } }) {
      html
      tableOfContents(maxDepth: 4)
      frontmatter {
        title
        date
      }
    }
  }
`;

export default BlogPost;
