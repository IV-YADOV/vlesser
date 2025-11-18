"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import {
  Download,
  Import,
  Link as LinkIcon,
  CheckCircle,
  Zap,
  HelpCircle,
  AlertCircle,
} from "lucide-react";
import { useState } from "react";

const steps = [
  {
    number: 1,
    title: "Скачайте приложение",
    description: "Выберите одно из приложений для Android или iOS",
    icon: Download,
    details: [
      "v2rayNG (Android) - рекомендуемое",
      "NapsternetV (iOS/Android)",
      "WarpX (iOS)",
    ],
  },
  {
    number: 2,
    title: "Нажмите 'Импорт'",
    description: "В приложении найдите кнопку импорта конфигурации",
    icon: Import,
    details: [
      "Откройте приложение",
      "Найдите меню или кнопку 'Импорт'",
      "Выберите 'Импорт из буфера обмена'",
    ],
  },
  {
    number: 3,
    title: "Вставьте VLESS-линк",
    description: "Скопируйте конфиг, который мы вам выдали, и вставьте его",
    icon: LinkIcon,
    details: [
      "Скопируйте VLESS-ссылку",
      "Вставьте в поле импорта",
      "Подтвердите импорт",
    ],
  },
  {
    number: 4,
    title: "Подтвердите",
    description: "Проверьте настройки и сохраните конфигурацию",
    icon: CheckCircle,
    details: [
      "Проверьте параметры подключения",
      "Сохраните конфигурацию",
      "Готово к использованию",
    ],
  },
  {
    number: 5,
    title: "Подключитесь",
    description: "Нажмите кнопку подключения и наслаждайтесь VPN",
    icon: Zap,
    details: [
      "Выберите ваш конфиг в списке",
      "Нажмите кнопку подключения",
      "Готово! Вы под защитой",
    ],
  },
];

const faq = [
  {
    question: "Какое приложение лучше использовать?",
    answer:
      "Для Android мы рекомендуем v2rayNG - это самое стабильное и функциональное приложение. Для iOS можно использовать NapsternetV или WarpX.",
  },
  {
    question: "Работает ли VPN на всех устройствах?",
    answer:
      "Да, VLESS конфиги работают на Android, iOS, Windows, macOS и Linux. Для каждого устройства есть подходящее приложение.",
  },
  {
    question: "Нужно ли настраивать что-то дополнительно?",
    answer:
      "Нет, после импорта конфига всё настроено автоматически. Просто подключитесь и используйте.",
  },
  {
    question: "Что делать, если не подключается?",
    answer:
      "Проверьте интернет-соединение, убедитесь что конфиг скопирован полностью, и попробуйте перезапустить приложение. Если проблема сохраняется - обратитесь в поддержку.",
  },
  {
    question: "Можно ли использовать на нескольких устройствах?",
    answer:
      "Да, один конфиг можно использовать на нескольких устройствах одновременно.",
  },
  {
    question: "Как продлить подписку?",
    answer:
      "Просто купите новый тариф на нашем сайте. Новый конфиг будет выдан автоматически после оплаты.",
  },
];

const problems = [
  {
    problem: "Не удаётся импортировать конфиг",
    solution:
      "Убедитесь, что вы скопировали весь конфиг полностью, включая префикс 'vless://'. Попробуйте скопировать ещё раз и вставить заново.",
  },
  {
    problem: "Подключение не устанавливается",
    solution:
      "Проверьте интернет-соединение. Убедитесь, что VPN не блокируется вашим провайдером. Попробуйте перезапустить приложение.",
  },
  {
    problem: "Медленная скорость",
    solution:
      "Попробуйте переподключиться к другому серверу (если доступно). Убедитесь, что у вас стабильное интернет-соединение. Закройте другие приложения, использующие интернет.",
  },
  {
    problem: "Приложение не запускается",
    solution:
      "Убедитесь, что у вас установлена последняя версия приложения. Переустановите приложение, если проблема сохраняется.",
  },
];

export default function InstructionsPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-16"
          >
            <h1 className="text-5xl sm:text-6xl font-bold mb-6">
              Как подключить <span className="gradient-text">VLESS VPN</span>
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Пошаговая инструкция по настройке VPN за 5 минут
            </p>
          </motion.div>

          <div className="space-y-8 mb-20">
            {steps.map((step, index) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="hover:border-blue-500/50 transition-all">
                  <CardHeader>
                    <div className="flex items-start space-x-4">
                      <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center flex-shrink-0">
                        <step.icon className="w-8 h-8 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="text-sm font-semibold text-blue-500">
                            Шаг {step.number}
                          </span>
                        </div>
                        <CardTitle className="text-2xl mb-2">
                          {step.title}
                        </CardTitle>
                        <CardDescription className="text-base">
                          {step.description}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 ml-20">
                      {step.details.map((detail, idx) => (
                        <li
                          key={idx}
                          className="flex items-start space-x-2 text-gray-300"
                        >
                          <span className="text-blue-500 mt-1">•</span>
                          <span>{detail}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-20"
          >
            <h2 className="text-4xl font-bold mb-8 text-center">
              Часто задаваемые <span className="gradient-text">вопросы</span>
            </h2>
            <div className="space-y-4">
              {faq.map((item, index) => (
                <Card
                  key={index}
                  className="cursor-pointer hover:border-blue-500/50 transition-all"
                  onClick={() =>
                    setOpenFaq(openFaq === index ? null : index)
                  }
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center space-x-2">
                        <HelpCircle className="w-5 h-5 text-blue-500" />
                        <span>{item.question}</span>
                      </CardTitle>
                      <span className="text-gray-400">
                        {openFaq === index ? "−" : "+"}
                      </span>
                    </div>
                  </CardHeader>
                  {openFaq === index && (
                    <CardContent>
                      <p className="text-gray-300">{item.answer}</p>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl font-bold mb-8 text-center">
              Проблемы и <span className="gradient-text">решения</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {problems.map((item, index) => (
                <Card
                  key={index}
                  className="hover:border-orange-500/50 transition-all"
                >
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center space-x-2">
                      <AlertCircle className="w-5 h-5 text-orange-500" />
                      <span>{item.problem}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-300">{item.solution}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mt-16 text-center"
          >
            <Card className="bg-gradient-to-br from-blue-600/10 to-purple-600/10 border-blue-500/50">
              <CardContent className="pt-6">
                <h3 className="text-2xl font-bold mb-4">
                  Нужна помощь? Свяжитесь с нами
                </h3>
                <p className="text-gray-400 mb-6">
                  Наша поддержка работает 24/7 и готова помочь с любыми
                  вопросами
                </p>
                <a
                  href="https://t.me/support"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold transition-colors"
                >
                  Написать в поддержку
                </a>
              </CardContent>
            </Card>
          </motion.div>
        </div>
    </div>
  );
}

