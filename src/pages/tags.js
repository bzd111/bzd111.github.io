import React from "react";
import { graphql, Link } from "gatsby";
import Layout from "../components/layout";

const AllTagsPage = ({ data }) => {
    const tags = data.allMarkdownRemark.group;

    return (
        <Layout>
            <div className="max-w-4xl mx-auto px-4 py-8">
                <h1 className="text-4xl font-bold mb-8 text-center">所有标签</h1>
                <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {tags.map(tag => (
                        <li key={tag.fieldValue} className="p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow">
                            <Link
                                to={`/tags/${tag.fieldValue}/`}
                                className="text-lg text-blue-600 hover:text-blue-800"
                            >
                                {tag.fieldValue}
                                <span className="text-gray-600">({tag.totalCount})</span>
                            </Link>
                        </li>
                    ))}
                </ul>
            </div>
        </Layout>
    );
};

export default AllTagsPage;

export const pageQuery = graphql`
  query {
    allMarkdownRemark(limit: 2000) {
      group(field: { frontmatter: { tags: SELECT } }) {
        fieldValue
        totalCount
      }
    }
  }
`;
