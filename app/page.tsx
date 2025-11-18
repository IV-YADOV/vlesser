"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Shield,
  Zap,
  Lock,
  MessageCircle,
  Check,
  ArrowRight,
  Globe,
  Server,
} from "lucide-react";
import { usePlans } from "@/hooks/usePlans";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
    },
  },
};

export default function Home() {
  const { plans: planData } = usePlans();

  return (
    <>
        {/* Hero Section */}
        <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
          <div className="container mx-auto max-w-6xl">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6">
                <span className="gradient-text">
                  Защищённый VPN доступ
                </span>
                <br />
                <span className="text-white">за 30 секунд</span>
              </h1>
              <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-8">
                Премиальный VLESS VPN с максимальной скоростью и безопасностью.
                Подключитесь за минуту и получите полную анонимность в сети.
              </p>
              <Link href="/checkout">
                <Button size="lg" className="text-lg px-12">
                  Купить конфиг
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
            </motion.div>

            {/* Features Grid */}
            <motion.div
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20"
            >
              {[
                {
                  icon: Shield,
                  title: "Безопасность",
                  description: "Военная шифровка данных",
                },
                {
                  icon: Zap,
                  title: "Скорость",
                  description: "До 1 Гбит/с без ограничений",
                },
                {
                  icon: Globe,
                  title: "Анонимность",
                  description: "Полная приватность в сети",
                },
                {
                  icon: MessageCircle,
                  title: "Поддержка",
                  description: "24/7 в Telegram",
                },
              ].map((feature, index) => (
                <motion.div key={index} variants={itemVariants}>
                  <Card className="h-full hover:border-blue-500/50 transition-all hover:shadow-lg hover:shadow-blue-500/20">
                    <CardHeader>
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center mb-4">
                        <feature.icon className="w-6 h-6 text-white" />
                      </div>
                      <CardTitle className="text-xl">{feature.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-base">
                        {feature.description}
                      </CardDescription>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-[#0f0f0f]">
          <div className="container mx-auto max-w-6xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <h2 className="text-4xl sm:text-5xl font-bold mb-4">
                Выберите <span className="gradient-text">тариф</span>
              </h2>
              <p className="text-xl text-gray-400">
                Гибкие планы для любых потребностей
              </p>
            </motion.div>

            <motion.div
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="grid grid-cols-1 md:grid-cols-3 gap-8"
            >
              {planData.map((plan, index) => (
                <motion.div key={plan.id} variants={itemVariants}>
                  <Card
                    className={`h-full relative flex flex-col ${
                      plan.popular
                        ? "border-2 border-blue-500 shadow-xl shadow-blue-500/20"
                        : ""
                    } hover:border-blue-500/50 transition-all`}
                  >
                    {plan.popular && (
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                        <span className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-1 rounded-full text-sm font-semibold">
                          Популярный
                        </span>
                      </div>
                    )}
                    <CardHeader>
                      <CardTitle className="text-2xl mb-2">{plan.name}</CardTitle>
                      <div className="mt-4">
                        <span className="text-4xl font-bold">{plan.price}₽</span>
                        <span className="text-gray-400 ml-2">
                          / {plan.duration} дней
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="flex flex-col flex-1">
                      <ul className="space-y-3 mb-6 flex-1">
                        {plan.features.map((feature, idx) => (
                          <li key={idx} className="flex items-center space-x-2">
                            <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                            <span className="text-gray-300">{feature}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-auto pt-4">
                        <Link href={`/checkout?plan=${plan.id}`}>
                          <Button
                            variant={plan.popular ? "default" : "outline"}
                            className="w-full"
                          >
                            Выбрать план
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* How It Works */}
        <section id="features" className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="container mx-auto max-w-6xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <h2 className="text-4xl sm:text-5xl font-bold mb-4">
                Как это <span className="gradient-text">работает</span>
              </h2>
              <p className="text-xl text-gray-400">
                Просто, быстро, безопасно
              </p>
            </motion.div>

            <motion.div
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="grid grid-cols-1 md:grid-cols-3 gap-8"
            >
              {[
                {
                  step: "1",
                  title: "Купите конфиг",
                  description:
                    "Выберите подходящий тариф и оплатите подписку. Получите VLESS-конфиг мгновенно.",
                },
                {
                  step: "2",
                  title: "Импортируйте",
                  description:
                    "Скачайте приложение v2rayNG или NapsternetV и импортируйте конфиг одним нажатием.",
                },
                {
                  step: "3",
                  title: "Подключитесь",
                  description:
                    "Нажмите кнопку подключения и наслаждайтесь быстрым и безопасным интернетом.",
                },
              ].map((item, index) => (
                <motion.div key={index} variants={itemVariants}>
                  <Card className="h-full text-center">
                    <CardHeader>
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                        {item.step}
                      </div>
                      <CardTitle className="text-2xl">{item.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-base">
                        {item.description}
                      </CardDescription>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-600/10 to-purple-600/10">
          <div className="container mx-auto max-w-4xl text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-4xl sm:text-5xl font-bold mb-6">
                Готовы начать?
              </h2>
              <p className="text-xl text-gray-400 mb-8">
                Получите защищённый доступ к интернету за 30 секунд
              </p>
              <Link href="/checkout">
                <Button size="lg" className="text-lg px-12">
                  Купить конфиг сейчас
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
            </motion.div>
          </div>
        </section>
    </>
  );
}
