import React from "react";
import Layout from "../components/layout";
import Seo from "../components/seo";

const friendLinks = [
    {
        name: "示例博客",
        description: "一个技术博客示例",
        link: "https://example.com"
    },
    {
        name: "开发者社区",
        description: "分享技术经验与见解",
        link: "https://example.com/dev"
    },
    {
        name: "技术笔记",
        description: "记录学习与成长",
        link: "https://example.com/notes"
    }
];

const LinksPage = () => {
    return (
        <Layout>
            <Seo title="友链" />
            <div className="max-w-6xl mx-auto px-4 py-8">
                <h1 className="text-4xl font-bold mb-8 text-center">友链</h1>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {friendLinks.map((friend, index) => (
                        <a
                            key={index}
                            href={friend.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 border border-gray-200"
                        >
                            <div>
                                <h2 className="text-xl font-semibold text-gray-800">
                                    {friend.name}
                                </h2>
                                <p className="text-gray-600 mt-1">
                                    {friend.description}
                                </p>
                            </div>
                        </a>
                    ))}
                </div>
            </div>
        </Layout>
    );
};

export const Head = () => <Seo title="友链" />;

export default LinksPage;
