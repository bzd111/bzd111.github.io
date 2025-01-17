import React from "react";
import { navigate } from "gatsby";
import Layout from "../components/layout";

const IndexPage = () => {
  if (typeof window !== "undefined") {
    navigate("/blog");
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-8 text-center">Loading...</h1>
      </div>
    </Layout>
  );
};

export default IndexPage;
