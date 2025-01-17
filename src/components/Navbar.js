import React from 'react'
import { Link } from 'gatsby'

const Navbar = () => {
    return (
        <nav className="bg-white shadow-lg fixed w-full top-0 z-50">
            <div className="max-w-6xl mx-auto px-4">
                <div className="flex justify-center">
                    <div className="flex space-x-7">
                        <Link
                            to="/"
                            className="flex items-center py-4 px-2 text-gray-700 hover:text-gray-900"
                        >
                            首页
                        </Link>
                        <Link
                            to="/tags"
                            className="flex items-center py-4 px-2 text-gray-700 hover:text-gray-900"
                        >
                            标签
                        </Link>
                        <Link
                            to="/about"
                            className="flex items-center py-4 px-2 text-gray-700 hover:text-gray-900"
                        >
                            关于
                        </Link>
                        <Link
                            to="/links"
                            className="flex items-center py-4 px-2 text-gray-700 hover:text-gray-900"
                        >
                            友链
                        </Link>
                    </div>
                </div>
            </div>
        </nav>
    )
}

export default Navbar
