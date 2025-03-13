import React from "react"
import Layout from "../components/layout"
import Footer from "../components/Footer"

const AboutPage = () => {
    return (
        <div>
            <Layout />
            <div className="max-w-4xl mx-auto px-4 py-8">
                <div className="text-left">
                    <h1 className="text-4xl font-bold mb-8">关于我</h1>
                    <div className="prose prose-lg">
                        <section className="mb-8">
                            <h2 className="text-2xl font-semibold mb-4">个人简介</h2>
                            <p className="text-gray-700">全干工程师，专注于云原生技术和DevOps实践。拥有丰富的后端开发经验，同时也热衷于前端技术的学习和实践。</p>
                        </section>

                        <section className="mb-8">
                            <h2 className="text-2xl font-semibold mb-4">技术栈</h2>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <h3 className="text-xl font-medium mb-2">后端技术</h3>
                                    <ul className="list-disc pl-4 text-gray-700">
                                        <li>Python</li>
                                        <li>Go</li>
                                        <li>Node.js</li>
                                        <li>Rust</li>
                                    </ul>
                                </div>
                                <div>
                                    <h3 className="text-xl font-medium mb-2">前端技术</h3>
                                    <ul className="list-disc pl-4 text-gray-700">
                                        <li>React</li>
                                        <li>TypeScript</li>
                                        <li>Tailwind CSS</li>
                                    </ul>
                                </div>
                            </div>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold mb-4">联系方式</h2>
                            <ul className="list-none text-gray-700">
                                <li>
                                    <a href="https://github.com/bzd111" className="text-blue-600 hover:text-blue-800" target="_blank" rel="noopener noreferrer">
                                        GitHub: bzd111
                                    </a>
                                </li>
                            </ul>
                        </section>
                    </div>
                </div>
            </div>
            <Footer />
        </div>
    )
}

export default AboutPage
