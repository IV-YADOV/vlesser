"use client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { Users, ShoppingCart, Key, Search, DollarSign, TrendingUp, Ticket, Plus, Trash2, Shield, LifeBuoy, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Plan } from "@/types/database";
import { plans as defaultPlans } from "@/lib/plans";

export default function AdminPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [promocodes, setPromocodes] = useState<any[]>([]);
  const [planSettings, setPlanSettings] = useState<Plan[]>(defaultPlans);
  const [planPriceDraft, setPlanPriceDraft] = useState<Record<string, string>>(
    Object.fromEntries(defaultPlans.map((plan) => [plan.id, plan.price.toString()]))
  );
  const [savingPlanId, setSavingPlanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [manualConfig, setManualConfig] = useState({ userId: "", plan: "premium" });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminToken, setAdminToken] = useState("");
  const [showPromocodeForm, setShowPromocodeForm] = useState(false);
  const [newPromocode, setNewPromocode] = useState({
    code: "",
    discount_type: "percentage",
    discount_value: 10,
    max_uses: null as number | null,
    expires_at: "",
    min_amount: null as number | null,
  });
  const [tickets, setTickets] = useState<any[]>([]);
  const [ticketFilter, setTicketFilter] = useState("open");
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [ticketMessages, setTicketMessages] = useState<any[]>([]);
  const [ticketReply, setTicketReply] = useState("");
  const getAdminHeaderToken = () => adminToken || localStorage.getItem("admin_token") || "";
  const shortTicketId = (id: string) => `#${id?.split("-")[0]}`;
  const supabase = createClient();

  useEffect(() => {
    // Проверяем авторизацию админа
    const savedToken = localStorage.getItem("admin_token");
    if (savedToken) {
      setIsAuthenticated(true);
      setAdminToken(savedToken);
      loadData();
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadTickets(ticketFilter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, ticketFilter]);

  const handleAdminLogin = async () => {
    // Проверяем токен через API
    try {
      const res = await fetch("/api/admin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: adminToken }),
      });
      
      if (res.ok) {
        localStorage.setItem("admin_token", adminToken);
        setIsAuthenticated(true);
        loadData();
      } else {
        alert("Неверный токен администратора");
      }
    } catch (error) {
      alert("Ошибка проверки токена");
    }
  };

  const loadData = async () => {
    try {
      const [usersRes, paymentsRes, subsRes, promocodesRes, planRes] = await Promise.all([
        supabase.from("users").select("*").order("created_at", { ascending: false }),
        supabase.from("payments").select("*").order("created_at", { ascending: false }),
        supabase.from("subscriptions").select("*").order("created_at", { ascending: false }),
        fetch("/api/promocodes/list", {
          headers: { "x-admin-token": adminToken || localStorage.getItem("admin_token") || "" },
        })
          .then((res) => res.json())
          .then((data) => data.promocodes || [])
          .catch(() => []),
        fetch("/api/plans")
          .then((res) => res.json())
          .then((data) => data.plans || defaultPlans)
          .catch(() => defaultPlans),
      ]);
      
      if (usersRes.data) setUsers(usersRes.data);
      if (paymentsRes.data) setPayments(paymentsRes.data);
      if (subsRes.data) setSubscriptions(subsRes.data);
      if (promocodesRes) setPromocodes(promocodesRes);
      if (planRes) {
        setPlanSettings(planRes);
        const draft: Record<string, string> = {};
        planRes.forEach((plan: Plan) => {
          draft[plan.id] = plan.price.toString();
        });
        setPlanPriceDraft(draft);
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadTickets = async (status = ticketFilter) => {
    if (!isAuthenticated) return;
    setLoadingTickets(true);
    try {
      const res = await fetch(`/api/support/admin/tickets?status=${status}`, {
        headers: { "x-admin-token": getAdminHeaderToken() },
      });
      if (!res.ok) throw new Error("Failed to load tickets");
      const data = await res.json();
      setTickets(data.tickets || []);
      if (selectedTicket) {
        const updated = data.tickets?.find((t: any) => t.id === selectedTicket.id);
        if (updated) setSelectedTicket(updated);
      }
    } catch (error) {
      console.error("Error loading tickets:", error);
    } finally {
      setLoadingTickets(false);
    }
  };

  const loadTicketMessages = async (ticketId: string) => {
    try {
      const res = await fetch(`/api/support/admin/tickets/${ticketId}/messages`, {
        headers: { "x-admin-token": getAdminHeaderToken() },
      });
      if (!res.ok) throw new Error("Failed to load messages");
      const data = await res.json();
      setSelectedTicket(data.ticket);
      setTicketMessages(data.messages || []);
    } catch (error) {
      console.error("Error loading ticket messages:", error);
    }
  };

  const handleSelectTicket = async (ticket: any) => {
    setSelectedTicket(ticket);
    setTicketReply("");
    await loadTicketMessages(ticket.id);
  };

  const handleSendTicketReply = async () => {
    if (!selectedTicket || !ticketReply.trim()) return;
    try {
      const res = await fetch(`/api/support/admin/tickets/${selectedTicket.id}/reply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": getAdminHeaderToken(),
        },
        body: JSON.stringify({ message: ticketReply.trim(), adminName: "Администратор" }),
      });
      if (!res.ok) throw new Error("Failed to send reply");
      setTicketReply("");
      await loadTicketMessages(selectedTicket.id);
      await loadTickets(ticketFilter);
    } catch (error) {
      console.error("Error sending reply:", error);
      alert("Не удалось отправить ответ");
    }
  };

  const handleChangeTicketStatus = async (ticketId: string, status: string) => {
    try {
      const res = await fetch(`/api/support/admin/tickets/${ticketId}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": getAdminHeaderToken(),
        },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      if (selectedTicket?.id === ticketId) {
        await loadTicketMessages(ticketId);
      }
      await loadTickets(ticketFilter);
    } catch (error) {
      console.error("Error updating ticket status:", error);
      alert("Не удалось обновить статус");
    }
  };

  const ticketStatusLabels: Record<string, string> = {
    open: "Новый",
    pending: "В работе",
    answered: "Есть ответ",
    closed: "Закрыт",
  };

  const handleCreatePromocode = async () => {
    try {
      const res = await fetch("/api/promocodes/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": adminToken || localStorage.getItem("admin_token") || "",
        },
        body: JSON.stringify({
          ...newPromocode,
          expires_at: newPromocode.expires_at || null,
        }),
      });

      const data = await res.json();
      if (data.success) {
        alert("Промокод создан успешно!");
        setShowPromocodeForm(false);
        setNewPromocode({
          code: "",
          discount_type: "percentage",
          discount_value: 10,
          max_uses: null,
          expires_at: "",
          min_amount: null,
        });
        loadData();
      } else {
        alert("Ошибка: " + (data.error || "Неизвестная ошибка"));
      }
    } catch (error) {
      console.error("Error creating promocode:", error);
      alert("Ошибка при создании промокода");
    }
  };

  const handleDeletePromocode = async (id: string) => {
    if (!confirm("Удалить промокод?")) return;
    
    try {
      const res = await fetch(`/api/promocodes/delete?id=${id}`, {
        method: "DELETE",
        headers: {
          "x-admin-token": adminToken || localStorage.getItem("admin_token") || "",
        },
      });

      const data = await res.json();
      if (data.success) {
        alert("Промокод удален!");
        loadData();
      } else {
        alert("Ошибка: " + (data.error || "Неизвестная ошибка"));
      }
    } catch (error) {
      console.error("Error deleting promocode:", error);
      alert("Ошибка при удалении промокода");
    }
  };

  const handlePlanPriceChange = (planId: string, value: string) => {
    setPlanPriceDraft((prev) => ({
      ...prev,
      [planId]: value,
    }));
  };

  const handleSavePlanPrice = async (planId: string) => {
    const priceValue = parseFloat(planPriceDraft[planId]);
    if (isNaN(priceValue) || priceValue <= 0) {
      alert("Введите корректную стоимость тарифа");
      return;
    }

    setSavingPlanId(planId);
    try {
      const res = await fetch("/api/admin/updatePlan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": adminToken || localStorage.getItem("admin_token") || "",
        },
        body: JSON.stringify({ planId, price: priceValue }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Не удалось обновить тариф");
      }

      alert("Стоимость тарифа обновлена");
      loadData();
    } catch (error: any) {
      console.error("Plan update error:", error);
      alert(error.message || "Ошибка при обновлении тарифа");
    } finally {
      setSavingPlanId(null);
    }
  };

  const handleManualConfig = async () => {
    if (!manualConfig.userId) return;
    alert("Функция выдачи конфига вручную будет реализована через API");
  };

  // Статистика
  const totalRevenue = payments
    .filter((p) => p.status === "completed")
    .reduce((sum, p) => sum + (p.amount || 0), 0);
  
  const todayRevenue = payments
    .filter((p) => {
      const paymentDate = new Date(p.created_at);
      const today = new Date();
      return (
        p.status === "completed" &&
        paymentDate.toDateString() === today.toDateString()
      );
    })
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  const activeSubscriptions = subscriptions.filter(
    (s) => new Date(s.expires_at) > new Date()
  ).length;

  const filteredUsers = users.filter((u) => u.tg_id?.includes(searchQuery) || u.id.includes(searchQuery));
  const filteredPayments = payments.filter((p) => p.user_id.includes(searchQuery) || p.plan.includes(searchQuery));

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Shield className="w-5 h-5" />
              <span>Авторизация администратора</span>
            </CardTitle>
            <CardDescription>
              Введите токен администратора для доступа
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="password"
              placeholder="Токен администратора"
              value={adminToken}
              onChange={(e) => setAdminToken(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleAdminLogin()}
            />
            <Button onClick={handleAdminLogin} className="w-full">
              Войти
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-gray-400">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4 sm:p-8">
      <div className="container mx-auto max-w-7xl">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold gradient-text">Панель администратора</h1>
          <Button
            variant="outline"
            onClick={() => {
              localStorage.removeItem("admin_token");
              setIsAuthenticated(false);
            }}
          >
            Выйти
          </Button>
        </div>

        {/* Дашборд */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Всего пользователей</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{users.length}</div>
                <p className="text-xs text-muted-foreground">
                  Активных подписок: {activeSubscriptions}
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Общая прибыль</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalRevenue.toFixed(2)}₽</div>
                <p className="text-xs text-muted-foreground">
                  Сегодня: {todayRevenue.toFixed(2)}₽
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Всего платежей</CardTitle>
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{payments.length}</div>
                <p className="text-xs text-muted-foreground">
                  Завершено: {payments.filter((p) => p.status === "completed").length}
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Промокоды</CardTitle>
                <Ticket className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{promocodes.length}</div>
                <p className="text-xs text-muted-foreground">
                  Активных: {promocodes.filter((p) => p.is_active).length}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Управление тарифами */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5" />
              <span>Стоимость тарифов</span>
            </CardTitle>
            <CardDescription>Изменяйте цены тарифов. Изменения применяются сразу.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {planSettings.map((plan) => (
              <div key={plan.id} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center border border-gray-800 rounded-lg p-4">
                <div>
                  <p className="font-semibold">{plan.name}</p>
                  <p className="text-sm text-gray-400">{plan.duration} дней</p>
                </div>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  value={planPriceDraft[plan.id] ?? plan.price}
                  onChange={(e) => handlePlanPriceChange(plan.id, e.target.value)}
                />
                <Button
                  onClick={() => handleSavePlanPrice(plan.id)}
                  disabled={savingPlanId === plan.id}
                >
                  {savingPlanId === plan.id ? "Сохранение..." : "Сохранить"}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Управление промокодами */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <Ticket className="w-5 h-5" />
                <span>Управление промокодами</span>
              </CardTitle>
              <Button onClick={() => setShowPromocodeForm(!showPromocodeForm)}>
                <Plus className="w-4 h-4 mr-2" />
                Создать промокод
              </Button>
            </div>
          </CardHeader>
          {showPromocodeForm && (
            <CardContent className="space-y-4 border-t border-gray-800 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  placeholder="Код промокода"
                  value={newPromocode.code}
                  onChange={(e) =>
                    setNewPromocode({ ...newPromocode, code: e.target.value.toUpperCase() })
                  }
                />
                <select
                  value={newPromocode.discount_type}
                  onChange={(e) =>
                    setNewPromocode({ ...newPromocode, discount_type: e.target.value as "percentage" | "fixed" })
                  }
                  className="h-11 rounded-lg border border-gray-700 bg-[#1a1a1a] px-4 text-sm text-gray-100"
                >
                  <option value="percentage">Процент</option>
                  <option value="fixed">Фиксированная сумма</option>
                </select>
                <Input
                  type="number"
                  placeholder="Значение скидки"
                  value={newPromocode.discount_value}
                  onChange={(e) =>
                    setNewPromocode({ ...newPromocode, discount_value: parseFloat(e.target.value) || 0 })
                  }
                />
                <Input
                  type="number"
                  placeholder="Макс. использований (необязательно)"
                  value={newPromocode.max_uses || ""}
                  onChange={(e) =>
                    setNewPromocode({
                      ...newPromocode,
                      max_uses: e.target.value ? parseInt(e.target.value) : null,
                    })
                  }
                />
                <Input
                  type="datetime-local"
                  placeholder="Срок действия (необязательно)"
                  value={newPromocode.expires_at}
                  onChange={(e) =>
                    setNewPromocode({ ...newPromocode, expires_at: e.target.value })
                  }
                />
                <Input
                  type="number"
                  placeholder="Мин. сумма заказа (необязательно)"
                  value={newPromocode.min_amount || ""}
                  onChange={(e) =>
                    setNewPromocode({
                      ...newPromocode,
                      min_amount: e.target.value ? parseFloat(e.target.value) : null,
                    })
                  }
                />
              </div>
              <Button onClick={handleCreatePromocode} className="w-full">
                Создать промокод
              </Button>
            </CardContent>
          )}
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {promocodes.map((promo) => (
                <div
                  key={promo.id}
                  className="p-3 bg-[#0a0a0a] rounded-lg border border-gray-800 flex items-center justify-between"
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold">{promo.code}</span>
                      <span className={`text-xs px-2 py-1 rounded ${
                        promo.is_active ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500"
                      }`}>
                        {promo.is_active ? "Активен" : "Неактивен"}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      Скидка: {promo.discount_type === "percentage" ? `${promo.discount_value}%` : `${promo.discount_value}₽`}
                      {promo.max_uses && ` | Использовано: ${promo.current_uses}/${promo.max_uses}`}
                      {promo.expires_at && ` | До: ${format(new Date(promo.expires_at), "dd.MM.yyyy")}`}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeletePromocode(promo.id)}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Поддержка */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-center space-x-2">
                <LifeBuoy className="w-5 h-5" />
                <div>
                  <CardTitle>Обращения пользователей</CardTitle>
                  <CardDescription>Управляйте тикетами из Telegram-бота</CardDescription>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {["open", "pending", "answered", "closed", "all"].map((status) => (
                  <Button
                    key={status}
                    variant={ticketFilter === status ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTicketFilter(status)}
                  >
                    {ticketStatusLabels[status] || "Все"}
                  </Button>
                ))}
                <Button variant="ghost" size="sm" onClick={() => loadTickets(ticketFilter)}>
                  ↻ Обновить
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                {loadingTickets && <div className="text-gray-400 text-sm">Загрузка обращений...</div>}
                {!loadingTickets && tickets.length === 0 && (
                  <div className="text-gray-500 text-sm">Нет обращений с выбранным статусом.</div>
                )}
                {tickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className={`p-4 rounded-xl border ${selectedTicket?.id === ticket.id ? "border-blue-500 bg-blue-500/5" : "border-gray-800 bg-[#0a0a0a]"}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold">{ticket.subject}</p>
                        <p className="text-xs text-gray-400">
                          {shortTicketId(ticket.id)} • {ticket.category}
                        </p>
                        <p className="text-xs text-gray-500">
                          Пользователь: {ticket.username || "—"} (TG: {ticket.tg_id})
                        </p>
                      </div>
                      <span className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-200">
                        {ticketStatusLabels[ticket.status] || ticket.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">
                      Создано: {format(new Date(ticket.created_at), "dd.MM.yyyy HH:mm")}
                    </p>
                    <div className="flex items-center justify-between">
                      <Button size="sm" variant="outline" onClick={() => handleSelectTicket(ticket)}>
                        Просмотр
                      </Button>
                      {ticket.status !== "closed" && (
                        <Button size="sm" variant="ghost" onClick={() => handleChangeTicketStatus(ticket.id, "closed")}>
                          Закрыть
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="border border-gray-800 rounded-xl p-4 bg-[#0a0a0a] min-h-[420px]">
                {selectedTicket ? (
                  <>
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-semibold">{shortTicketId(selectedTicket.id)}</h3>
                        <p className="text-sm text-gray-400">
                          Пользователь: {selectedTicket.username || "—"}
                        </p>
                        <p className="text-xs text-gray-500">Telegram ID: {selectedTicket.tg_id}</p>
                      </div>
                      <span className="text-xs px-3 py-1 rounded bg-gray-800 text-gray-200">
                        {ticketStatusLabels[selectedTicket.status] || selectedTicket.status}
                      </span>
                    </div>
                    <div className="max-h-64 overflow-y-auto border border-gray-800 rounded-lg p-3 mb-4 space-y-3">
                      {ticketMessages.map((message) => (
                        <div key={message.id} className="text-sm">
                          <p className="text-gray-400 text-xs flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />
                            {message.author_type === "admin" ? "Админ" : "Пользователь"}
                            <span className="text-gray-500">
                              • {format(new Date(message.created_at), "dd.MM.yyyy HH:mm")}
                            </span>
                          </p>
                          <p className="text-gray-100 whitespace-pre-line">{message.message}</p>
                        </div>
                      ))}
                      {!ticketMessages.length && (
                        <p className="text-gray-500 text-sm">Нет сообщений в этом тикете.</p>
                      )}
                    </div>
                    <div className="space-y-3">
                      <textarea
                        className="w-full rounded-lg border border-gray-800 bg-transparent p-3 text-sm text-gray-100"
                        rows={4}
                        placeholder="Введите ответ..."
                        value={ticketReply}
                        onChange={(e) => setTicketReply(e.target.value)}
                      />
                      <div className="flex items-center gap-2">
                        <Button onClick={handleSendTicketReply} disabled={!ticketReply.trim()}>
                          Отправить ответ
                        </Button>
                        {selectedTicket.status !== "pending" && selectedTicket.status !== "open" && (
                          <Button
                            variant="outline"
                            onClick={() => handleChangeTicketStatus(selectedTicket.id, "pending")}
                          >
                            Пометить как в работе
                          </Button>
                        )}
                        {selectedTicket.status !== "closed" && (
                          <Button
                            variant="ghost"
                            onClick={() => handleChangeTicketStatus(selectedTicket.id, "closed")}
                          >
                            Закрыть тикет
                          </Button>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-gray-500 text-sm h-full flex items-center justify-center">
                    Выберите тикет слева, чтобы просмотреть диалог и ответить пользователю.
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Поиск */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              placeholder="Поиск по ID или Telegram ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Выдача конфига вручную */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Key className="w-5 h-5" />
              <span>Выдать конфиг вручную</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                placeholder="User ID"
                value={manualConfig.userId}
                onChange={(e) => setManualConfig({ ...manualConfig, userId: e.target.value })}
              />
              <select
                value={manualConfig.plan}
                onChange={(e) => setManualConfig({ ...manualConfig, plan: e.target.value })}
                className="h-11 rounded-lg border border-gray-700 bg-[#1a1a1a] px-4 text-sm text-gray-100"
              >
                <option value="start">Старт</option>
                <option value="premium">Премиум</option>
                <option value="unlimited">Безлимит</option>
              </select>
              <Button onClick={handleManualConfig}>Выдать конфиг</Button>
            </div>
          </CardContent>
        </Card>

        {/* Таблицы */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Пользователи</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredUsers.map((user) => (
                  <div key={user.id} className="p-3 bg-[#0a0a0a] rounded-lg border border-gray-800">
                    <div className="text-sm font-semibold">ID: {user.id}</div>
                    <div className="text-xs text-gray-400">TG: {user.tg_id || "N/A"}</div>
                    <div className="text-xs text-gray-500">
                      {format(new Date(user.created_at), "dd.MM.yyyy HH:mm")}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Платежи</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredPayments.map((payment) => (
                  <div key={payment.id} className="p-3 bg-[#0a0a0a] rounded-lg border border-gray-800">
                    <div className="flex justify-between items-start mb-1">
                      <div className="text-sm font-semibold">{payment.plan}</div>
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          payment.status === "completed"
                            ? "bg-green-500/20 text-green-500"
                            : payment.status === "pending"
                            ? "bg-yellow-500/20 text-yellow-500"
                            : "bg-red-500/20 text-red-500"
                        }`}
                      >
                        {payment.status}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400">User: {payment.user_id}</div>
                    {payment.promocode && (
                      <div className="text-xs text-blue-400">Промокод: {payment.promocode}</div>
                    )}
                    <div className="text-xs text-gray-500">
                      {format(new Date(payment.created_at), "dd.MM.yyyy HH:mm")}
                    </div>
                    <div className="text-sm font-semibold mt-1">
                      {payment.amount}₽
                      {payment.original_amount && payment.original_amount > payment.amount && (
                        <span className="text-xs text-gray-500 line-through ml-2">
                          {payment.original_amount}₽
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
