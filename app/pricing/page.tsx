"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import Link from "next/link";
import { Check, ArrowRight } from "lucide-react";
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

export default function PricingPage() {
  const { plans: planData } = usePlans();
  return (
    <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <h1 className="text-4xl sm:text-5xl font-bold mb-4">
              Выберите <span className="gradient-text">тариф</span>
            </h1>
            <p className="text-xl text-gray-400">
              Гибкие планы для любых потребностей
            </p>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12"
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
                          <ArrowRight className="ml-2 w-4 h-4" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-center"
          >
            <p className="text-gray-400 mb-4">
              Не уверены, какой тариф выбрать?
            </p>
            <Link href="/">
              <Button variant="outline">
                Вернуться на главную
              </Button>
            </Link>
          </motion.div>
        </div>
    </div>
  );
}

