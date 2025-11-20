import type { Metadata } from "next";
 import Link from "next/link";
import { plans } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Каталог услуг | VLESSer",
  description:
    "Фиксированные тарифы VLESSer с подробным описанием услуг и прозрачными ценами.",
};

const currencyFormatter = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

export default function CatalogPage() {
  return (
    <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="container mx-auto max-w-5xl">
        <header className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">
            Каталог услуг VLESSer
          </h1>
          <p className="text-lg text-gray-400">
            Здесь перечислены услуги VLESSer с фиксированными ценами и
            подробным описанием, чтобы вы понимали, что именно получаете.
          </p>
        </header>

        <section className="bg-[#111111] border border-gray-900 rounded-2xl p-6 mb-12">
          <h2 className="text-2xl font-semibold mb-4">
            Что именно покупает пользователь
          </h2>
          <p className="text-gray-300 mb-4">
            Каждый тариф — это готовый комплект для безопасного доступа к сети:
          </p>
          <ul className="list-disc list-inside space-y-2 text-gray-300">
            <li>
              Персональный VLESS-конфиг с уникальным UUID для подключения к
              премиальным серверам.
            </li>
            <li>
              Высокоскоростной VPN-трафик без ограничений по объёму на выбранный
              срок (30/90/365 дней).
            </li>
            <li>Инструкции по настройке для iOS, Android, Windows и macOS.</li>
            <li>
              Автоматическое продление профиля в системе и поддержка 24/7 в
              Telegram и по email.
            </li>
          </ul>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          {plans.map((plan) => (
            <article
              key={plan.id}
              className="border border-gray-800 rounded-2xl p-6 bg-[#0f0f0f] shadow-lg shadow-black/20"
            >
              <header className="mb-4">
                <div className="flex items-baseline justify-between">
                  <div>
                    <h2 className="text-2xl font-semibold">{plan.name}</h2>
                    <p className="text-gray-400 text-sm">
                      Период действия — {plan.duration} дней
                    </p>
                  </div>
                  <p className="text-3xl font-bold text-blue-400">
                    {currencyFormatter.format(plan.price)}
                  </p>
                </div>
                <p className="text-gray-400 mt-2 text-sm">
                  Цена включает подготовку и обслуживание подключения на весь
                  срок действия тарифа. Дополнительных и скрытых платежей нет.
                </p>
              </header>

              <div className="space-y-4 text-gray-200">
                <div>
                  <h3 className="text-lg font-semibold mb-2">
                    Что включено в тариф:
                  </h3>
                  <ul className="space-y-2 text-gray-300">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <span className="text-blue-400 pt-1">•</span>
                        <span>{feature}</span>
                      </li>
                    ))}
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 pt-1">•</span>
                      <span>
                        Персональный VLESS-профиль с уникальным UUID и готовыми
                        настройками для приложений на iOS, Android, Windows,
                        macOS и Linux.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 pt-1">•</span>
                      <span>
                        Инструкции по установке, QR-коды и текстовые конфиги для
                        быстрой активации.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 pt-1">•</span>
                      <span>
                        Поддержка 24/7 в Telegram и по e-mail по вопросам
                        подключения и продления.
                      </span>
                    </li>
                  </ul>
                </div>

                <div className="border border-gray-800 rounded-xl p-4 bg-[#101010]">
                  <h3 className="text-lg font-semibold mb-2">
                    Условия предоставления
                  </h3>
                  <ul className="list-disc list-inside text-gray-300 space-y-1">
                    <li>Срок доступа: {plan.duration} календарных дней.</li>
                    <li>Количество устройств: до 5 одновременно.</li>
                    <li>
                      Скорость: до 1 Гбит/с, в зависимости от канала провайдера
                      пользователя.
                    </li>
                    <li>Трафик: не ограничен.</li>
                  </ul>
                </div>

                <p className="text-sm text-gray-400 italic">
                  Чтобы оформить заказ, выберите тариф и перейдите на страницу
                  оплаты через раздел «Купить» в навигации или из личного
                  кабинета. Настоящая страница носит ознакомительный характер и
                  содержит полный перечень услуг с фиксированными ценами.
                </p>
              </div>
            </article>
          ))}
        </section>

        <section className="bg-[#111111] border border-gray-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-2xl font-semibold">Как это работает</h2>
          <ol className="space-y-3 text-gray-300 list-decimal list-inside">
            <li>Выберите тариф из каталога и нажмите кнопку «Оплатить».</li>
            <li>Заполните контактные данные и подтвердите заказ.</li>
            <li>
              Получите инструкции и готовый VLESS-конфиг в личном кабинете и в
              Telegram.
            </li>
          </ol>
          <p className="text-gray-400">
            Дополнительные вопросы? Ознакомьтесь с{" "}
            <Link
              href="/instructions"
              className="text-blue-400 hover:text-blue-300 underline"
            >
              инструкцией по подключению
            </Link>{" "}
            или напишите в поддержку.
          </p>
        </section>
      </div>
    </div>
  );
}

