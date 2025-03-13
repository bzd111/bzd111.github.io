import React from "react";
import Layout from "../components/layout";
import Seo from "../components/seo";

const friendLinks = [
    {
        name: "Laisky's Blog",
        description: "技术博客",
        link: "https://blog.laisky.com",
        avatar: "https://blog.laisky.com/favicon.ico"
    },
    {
        name: "卡瓦邦噶！",
        description: "技术博客",
        link: "https://www.kawabangga.com",
        avatar: "https://www.kawabangga.com/favicon.ico"
    },
    {
        name: "Manjusaka",
        description: "技术博客",
        link: "https://www.manjusaka.blog",
        avatar: "https://avatars.githubusercontent.com/u/7054676?v=4"
    },
    {
        name: "Armin Ronacher's Blog",
        description: "技术博客",
        link: "https://lucumr.pocoo.org",
        avatar: "https://lucumr.pocoo.org/static/avatar-large.jpg"

    },
    {
        name: "Asphaltt's Blog",
        description: "技术博客",
        link: "https://asphaltt.github.io/",
        avatar: "https://asphaltt.github.io/favicon.ico"
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
                            <div className="flex items-center space-x-4">
                                <img
                                    src={friend.avatar}
                                    alt={`${friend.name} avatar`}
                                    className="w-12 h-12 rounded-full object-cover"
                                    onError={(e) => {
                                        e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 24 24'%3E%3Cpath fill='%23ccc' d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z'/%3E%3C/svg%3E";
                                    }}
                                />
                                <div>
                                    <h2 className="text-xl font-semibold text-gray-800">
                                        {friend.name}
                                    </h2>
                                    <p className="text-gray-600 mt-1">
                                        {friend.description}
                                    </p>
                                </div>
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
