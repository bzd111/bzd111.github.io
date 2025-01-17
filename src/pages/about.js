import React from "react"
import Layout from "../components/layout"
import Footer from "../components/Footer"

const AboutPage = () => {
    return (
        <div>
            <Layout>
                <div className="max-w-4xl mx-auto px-4 py-8">
                    <h1 className="text-4xl font-bold mb-8">关于我</h1>
                    <div className="prose prose-lg">
                        <p>这里可以写一些关于你的介绍...</p>
                    </div>
                </div>
                <Footer />
            </Layout>
        </div>
    )
}

export default AboutPage
