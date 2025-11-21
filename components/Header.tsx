"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Shield, Menu, X } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TelegramAuth } from "@/components/TelegramAuth";

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-gray-900">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <Link 
            href="/" 
            className="flex items-center space-x-2"
            onClick={() => setMobileMenuOpen(false)}
          >
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold gradient-text">VLESSer</span>
          </Link>

          <nav className="hidden md:flex items-center space-x-8">
            <Link
              href="/#features"
              className="text-gray-400 hover:text-white transition-colors"
            >
              Преимущества
            </Link>
            <Link
              href="/pricing"
              className="text-gray-400 hover:text-white transition-colors"
            >
              Тарифы
            </Link>
            <Link
              href="/instructions"
              className="text-gray-400 hover:text-white transition-colors"
            >
              Инструкция
            </Link>
            <TelegramAuth />
          </nav>

          <button
            className="md:hidden text-gray-400 hover:text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-gray-900 bg-[#0a0a0a]"
          >
            <div className="container mx-auto px-4 py-4 space-y-4">
              <Link
                href="/#features"
                className="block text-gray-400 hover:text-white transition-colors py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Преимущества
              </Link>
              <Link
                href="/pricing"
                className="block text-gray-400 hover:text-white transition-colors py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Тарифы
              </Link>
              <Link
                href="/instructions"
                className="block text-gray-400 hover:text-white transition-colors py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Инструкция
              </Link>
              <div className="pt-2 border-t border-gray-900">
                <TelegramAuth onLinkClick={() => setMobileMenuOpen(false)} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

