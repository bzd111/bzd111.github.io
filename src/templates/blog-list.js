import React from "react";
import { graphql, Link } from "gatsby";
import Layout from "../components/layout";

const BlogListTemplate = ({ data, pageContext }) => {
  const { currentPage, numPages } = pageContext;
  const posts = data.allMarkdownRemark.edges;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-8 text-center">Blog Posts</h1>
        <ul className="space-y-4">
          {posts.map(({ node }) => (
            <li key={node.id} className="p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow">
              <div className="flex justify-between items-center">
                <Link
                  to={node.fields.slug}
                  className="text-xl text-blue-600 hover:text-blue-800"
                >
                  {node.frontmatter.title}
                </Link>
                <span className="text-gray-600">
                  {node.frontmatter.date}
                </span>
              </div>
            </li>
          ))}
        </ul>

        {/* Pagination */}
        <div className="flex justify-center mt-8 space-x-4">
          {Array.from({ length: numPages }).map((_, i) => (
            <Link
              key={i}
              to={`/blog/${i === 0 ? "" : i + 1}`}
              className={`px-4 py-2 rounded ${i + 1 === currentPage
                ? "bg-blue-600 text-white"
                : "bg-gray-200 hover:bg-gray-300"
                }`}
            >
              {i + 1}
            </Link>
          ))}
        </div>
      </div>
    </Layout>
  );
};

export default BlogListTemplate;

export const query = graphql`
  query($skip: Int!, $limit: Int!) {
    allMarkdownRemark(
      sort: { fields: [frontmatter___date], order: DESC }
      limit: $limit
      skip: $skip
      filter: { frontmatter: { date: { ne: null } } }
    ) {
      edges {
        node {
          id
          frontmatter {
            title
            date(formatString: "YYYY-MM-DD")
          }
          fields {
            slug
          }
        }
      }
    }
  }
`;
