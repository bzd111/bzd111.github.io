import React from "react";
import { graphql, Link } from "gatsby";
import Layout from "../components/layout";

const TagsPage = ({ data, pageContext }) => {
  const { tag } = pageContext;
  const { edges } = data.allMarkdownRemark;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 pt-20 pb-8 relative">
        {/* Main Content */}
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-8 text-center">Tag: {tag}</h1>
          <ul className="space-y-4">
            {edges.map(({ node }) => (
              <li key={node.id} className="p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow">
                <Link
                  to={node.fields.slug}
                  className="text-xl text-blue-600 hover:text-blue-800"
                >
                  {node.frontmatter.title}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-8 text-center">
            <Link
              to="/tags"
              className="inline-block px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              All Tags
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default TagsPage;

export const pageQuery = graphql`
  query($tag: String) {
    allMarkdownRemark(
      filter: { frontmatter: { tags: { in: [$tag] } } }
      sort: { fields: [frontmatter___date], order: DESC }
    ) {
      edges {
        node {
          id
          frontmatter {
            title
          }
          fields {
            slug
          }
        }
      }
    }
  }
`;
