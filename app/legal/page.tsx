"use client";

import { motion } from "framer-motion";
import { Shield, FileText, Mail, Phone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LegalPage() {
  return (
    <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="container mx-auto max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold">
              <span className="gradient-text">Юридическая информация</span>
            </h1>
          </div>
        </motion.div>

        <div className="space-y-6">
          {/* Реквизиты */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Shield className="w-5 h-5 text-blue-500" />
                  <span>Реквизиты</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2 border-b border-gray-800">
                    <span className="text-gray-400 mb-1 sm:mb-0">ФИО:</span>
                    <span className="text-white font-semibold">Ядов Иван Александрович</span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2 border-b border-gray-800">
                    <span className="text-gray-400 mb-1 sm:mb-0">ИНН:</span>
                    <span className="text-white font-semibold">270399831644</span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2">
                    <span className="text-gray-400 mb-1 sm:mb-0">Статус:</span>
                    <span className="text-white font-semibold">Самозанятый (НПД)</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Условия предоставления услуг */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Условия предоставления услуг</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-gray-300">
                <p>
                      Настоящий документ определяет условия предоставления услуг VPN-доступа через платформу VLESSer.
                </p>
                <div className="space-y-3">
                  <div>
                    <h3 className="text-white font-semibold mb-2">1. Предмет договора</h3>
                    <p className="text-gray-400">
                      Исполнитель обязуется предоставить Заказчику доступ к VPN-сервису на условиях выбранного тарифного плана.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-2">2. Порядок оказания услуг</h3>
                    <p className="text-gray-400">
                      После оплаты выбранного тарифа Заказчик получает VLESS-конфигурацию для подключения к VPN-серверу.
                      Услуга предоставляется на срок, указанный в выбранном тарифном плане.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-2">3. Обязательства сторон</h3>
                    <p className="text-gray-400">
                      Исполнитель обязуется обеспечить стабильную работу VPN-сервиса в рамках технических возможностей.
                      Заказчик обязуется использовать услугу в соответствии с законодательством РФ.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-2">4. Возврат средств</h3>
                    <p className="text-gray-400">
                      Возврат средств возможен в течение 14 дней с момента оплаты при условии, что услуга не была использована.
                      Для возврата средств необходимо обратиться в службу поддержки.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Политика конфиденциальности */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Политика конфиденциальности</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-gray-300">
                <p>
                  Мы обязуемся защищать конфиденциальность ваших персональных данных в соответствии с законодательством РФ.
                </p>
                <div className="space-y-3">
                  <div>
                    <h3 className="text-white font-semibold mb-2">Сбор данных</h3>
                    <p className="text-gray-400">
                      Мы собираем минимально необходимые данные для предоставления услуг: идентификатор Telegram, 
                      информация о подписках и платежах.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-2">Использование данных</h3>
                    <p className="text-gray-400">
                      Персональные данные используются исключительно для предоставления VPN-услуг, обработки платежей 
                      и связи с пользователем.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-2">Защита данных</h3>
                    <p className="text-gray-400">
                      Все данные хранятся в защищённой базе данных Supabase с применением современных методов шифрования.
                      Мы не передаём ваши данные третьим лицам без вашего согласия.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Контакты */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Контактная информация</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-400 mb-4">
                  По всем вопросам, связанным с предоставлением услуг, вы можете обратиться через Telegram бота.
                </p>
                <div className="flex items-center space-x-2 text-gray-300">
                  <Shield className="w-5 h-5 text-blue-500" />
                  <span>Telegram: @vpn_securebot</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

