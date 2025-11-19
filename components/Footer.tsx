import Link from "next/link";
import { Shield, Mail, MessageCircle, FileText } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-gray-900 bg-[#0a0a0a]">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
                <div className="flex items-center space-x-2 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-xl font-bold gradient-text">VLESSer</span>
                </div>
            <p className="text-gray-400 max-w-md">
              Премиальный VPN-сервис с использованием протокола VLESS. Быстро,
              безопасно, анонимно.
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Навигация</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/catalog"
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  Каталог
                </Link>
              </li>
              <li>
                <Link
                  href="/pricing"
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  Тарифы
                </Link>
              </li>
              <li>
                <Link
                  href="/instructions"
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  Инструкция
                </Link>
              </li>
              <li>
                <Link
                  href="/checkout"
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  Купить
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Поддержка</h3>
            <ul className="space-y-2">
              <li>
                <a
                  href="https://t.me/support"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white transition-colors flex items-center space-x-2"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Telegram</span>
                </a>
              </li>
                  <li>
                    <a
                      href="mailto:support@vlesser.com"
                      className="text-gray-400 hover:text-white transition-colors flex items-center space-x-2"
                    >
                      <Mail className="w-4 h-4" />
                      <span>Email</span>
                    </a>
                  </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-gray-900">
          <div className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0">
                <div className="text-center sm:text-right">
                  <p className="text-gray-400 text-sm">© 2025 VLESSer. Все права защищены.</p>
                  <p className="text-xs text-gray-500 mt-1">Code is art. Signed by YADOV.</p>
                </div>
            <Link
              href="/legal"
              className="text-gray-400 hover:text-white transition-colors flex items-center space-x-2 text-sm"
            >
              <FileText className="w-4 h-4" />
              <span>Юридическая информация</span>
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

