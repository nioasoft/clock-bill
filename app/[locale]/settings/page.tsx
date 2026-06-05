"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/src/i18n/navigation";
import { DeleteAccountSection } from "@/components/delete-account-section";
import { AppLayout } from "@/components/app-layout";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { fieldClass } from "@/lib/form-styles";

interface Session {
  id: string;
  created_at: string;
  expires_at: string;
  is_current: boolean;
}

interface Profile {
  id: string;
  userId: string;
  businessName: string | null;
  logoUrl: string | null;
  signatureUrl: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  taxId: string | null;
  website: string | null;
  defaultCurrency: string;
  preferredPdfTemplate: string;
  invoicePrefix: string | null;
  nextInvoiceNumber: number | null;
  paymentTerms: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankBranch: string | null;
  bankSwift: string | null;
  pdfPrimaryColor: string;
  pdfAccentColor: string;
  longTimerEnabled: boolean;
  longTimerThreshold: number;
  dailyReminderEnabled: boolean;
  dailyReminderTime: string;
  lastReminderDate: string | null;
  workingHours: number;
  dateFormat: string;
  timeFormat: string;
  firstDayOfWeek: string;
  createdAt: string;
  updatedAt: string;
}

interface CurrencyRate {
  id: string;
  user_id: string;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  createdAt: string;
  updatedAt: string;
}

export default function SettingsPage() {
  const t = useTranslations("Settings");
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"profile" | "security" | "currencies" | "notifications">("profile");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [currencyRates, setCurrencyRates] = useState<CurrencyRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [logoLoading, setLogoLoading] = useState(false);
  const [signatureLoading, setSignatureLoading] = useState(false);
  const [error, setError] = useState("");
  const [profileError, setProfileError] = useState("");
  const [logoError, setLogoError] = useState("");
  const [signatureError, setSignatureError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [logoutAllLoading, setLogoutAllLoading] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);

  // Notification settings state
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | null>(null);
  const [longTimerEnabled, setLongTimerEnabled] = useState(true);
  const [longTimerThreshold, setLongTimerThreshold] = useState("120");
  const [dailyReminderEnabled, setDailyReminderEnabled] = useState(false);
  const [dailyReminderTime, setDailyReminderTime] = useState("09:00");
  const [workingHours, setWorkingHours] = useState("8");
  const [firstDayOfWeek, setFirstDayOfWeek] = useState("sunday");
  const [testingNotification, setTestingNotification] = useState(false);

  // Currency rates form state
  const [fromCurrency, setFromCurrency] = useState("USD");
  const [toCurrency, setToCurrency] = useState("ILS");
  const [rate, setRate] = useState("");
  const [rateSaving, setRateSaving] = useState(false);
  const [rateError, setRateError] = useState("");
  const [rateSuccess, setRateSuccess] = useState("");

  // Profile form state
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [taxId, setTaxId] = useState("");
  const [website, setWebsite] = useState("");
  const [defaultCurrency, setDefaultCurrency] = useState("ILS");
  const [preferredPdfTemplate, setPreferredPdfTemplate] = useState("modern");
  const [invoicePrefix, setInvoicePrefix] = useState("");
  const [nextInvoiceNumber, setNextInvoiceNumber] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankBranch, setBankBranch] = useState("");
  const [bankSwift, setBankSwift] = useState("");
  const [pdfPrimaryColor, setPdfPrimaryColor] = useState("#A8622D");
  const [pdfAccentColor, setPdfAccentColor] = useState("#347B52");
  const [dateFormat, setDateFormat] = useState("DD/MM/YYYY");
  const [timeFormat, setTimeFormat] = useState("24h");

  useEffect(() => {
    if (activeTab === "security") {
      fetchSessions();
    } else if (activeTab === "profile") {
      fetchProfile();
    } else if (activeTab === "currencies") {
      fetchCurrencyRates();
    } else if (activeTab === "notifications") {
      fetchProfile();
      checkNotificationPermission();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Check notification permission on mount
  useEffect(() => {
    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const checkNotificationPermission = () => {
    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
    }
  };

  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) {
      alert(t("toasts.notificationsUnsupported"));
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);

    if (permission === "granted") {
      setSuccessMessage(t("toasts.permissionGranted"));
      setTimeout(() => setSuccessMessage(""), 3000);
    }
  };

  // Fetch profile data
  const fetchProfile = async () => {
    setLoading(true);
    setProfileError("");
    try {
      const response = await fetch("/api/profile");
      const data = await response.json();

      if (data.success) {
        setProfile(data.profile);
        // Initialize form state
        setBusinessName(data.profile.businessName || "");
        setPhone(data.profile.phone || "");
        setEmail(data.profile.email || "");
        setAddress(data.profile.address || "");
        setTaxId(data.profile.taxId || "");
        setWebsite(data.profile.website || "");
        setDefaultCurrency(data.profile.defaultCurrency || "ILS");
        setPreferredPdfTemplate(data.profile.preferredPdfTemplate || "modern");
        setInvoicePrefix(data.profile.invoicePrefix || "");
        setNextInvoiceNumber(data.profile.nextInvoiceNumber?.toString() || "");
        setPaymentTerms(data.profile.paymentTerms || "");
        setBankName(data.profile.bankName || "");
        setBankAccountNumber(data.profile.bankAccountNumber || "");
        setBankBranch(data.profile.bankBranch || "");
        setBankSwift(data.profile.bankSwift || "");
        setPdfPrimaryColor(data.profile.pdfPrimaryColor || "#A8622D");
        setPdfAccentColor(data.profile.pdfAccentColor || "#347B52");
        // Initialize notification settings
        setLongTimerEnabled(data.profile.longTimerEnabled ?? true);
        setLongTimerThreshold((data.profile.longTimerThreshold ?? 120).toString());
        setDailyReminderEnabled(data.profile.dailyReminderEnabled ?? false);
        setDailyReminderTime(data.profile.dailyReminderTime ?? "09:00");
        setWorkingHours((data.profile.workingHours ?? 8).toString());
        setFirstDayOfWeek(data.profile.firstDayOfWeek ?? "sunday");
        // Initialize format preferences
        setDateFormat(data.profile.dateFormat || "DD/MM/YYYY");
        setTimeFormat(data.profile.timeFormat || "24h");
      } else {
        setProfileError(data.message || t("toasts.loadProfileError"));
      }
    } catch {
      setProfileError(t("toasts.networkError"));
    } finally {
      setLoading(false);
    }
  };

  const fetchSessions = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/sessions");
      const data = await response.json();

      if (data.success) {
        setSessions(data.sessions || []);
      } else {
        setError(data.message || t("toasts.loadSessionsError"));
      }
    } catch {
      setError(t("toasts.networkError"));
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("he-IL", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getDeviceInfo = (sessionId: string) => {
    // In a real implementation, this would use user-agent parsing
    // For now, we return a generic device identifier
    return t("security.deviceLabel", { id: sessionId.slice(0, 8) });
  };

  const handleLogoutAll = async () => {
    setLogoutAllLoading(true);
    setError("");
    try {
      const response = await fetch("/api/sessions", {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        // Redirect to login page after successful logout
        router.push("/login");
      } else {
        setError(data.message || t("toasts.logoutAllError"));
        setShowConfirmDialog(false);
      }
    } catch {
      setError(t("toasts.networkError"));
      setShowConfirmDialog(false);
    } finally {
      setLogoutAllLoading(false);
    }
  };

  // Save profile changes
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileError("");
    setSuccessMessage("");

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: businessName || null,
          phone: phone || null,
          email: email || null,
          address: address || null,
          taxId: taxId || null,
          website: website || null,
          defaultCurrency: defaultCurrency || null,
          preferredPdfTemplate: preferredPdfTemplate || null,
          invoicePrefix: invoicePrefix || null,
          nextInvoiceNumber: nextInvoiceNumber ? parseInt(nextInvoiceNumber, 10) : null,
          paymentTerms: paymentTerms || null,
          bankName: bankName || null,
          bankAccountNumber: bankAccountNumber || null,
          bankBranch: bankBranch || null,
          bankSwift: bankSwift || null,
          pdfPrimaryColor: pdfPrimaryColor || "#A8622D",
          pdfAccentColor: pdfAccentColor || "#347B52",
          dateFormat: dateFormat || "DD/MM/YYYY",
          timeFormat: timeFormat || "24h",
        }),
      });

      const data = await response.json();

      if (data.success) {
        setProfile(data.profile);
        setSuccessMessage(t("toasts.profileSaved"));
        // Clear success message after 3 seconds
        setTimeout(() => setSuccessMessage(""), 3000);
      } else {
        setProfileError(data.message || t("toasts.saveProfileError"));
      }
    } catch {
      setProfileError(t("toasts.networkError"));
    } finally {
      setProfileLoading(false);
    }
  };

  // Save notification settings
  const handleSaveNotificationSettings = async () => {
    setProfileLoading(true);
    setProfileError("");
    setSuccessMessage("");

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          longTimerEnabled,
          longTimerThreshold: parseInt(longTimerThreshold, 10),
          dailyReminderEnabled,
          dailyReminderTime,
          workingHours: parseFloat(workingHours),
          firstDayOfWeek,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setProfile(data.profile);
        setSuccessMessage(t("toasts.notificationSettingsSaved"));
        setTimeout(() => setSuccessMessage(""), 3000);
      } else {
        setProfileError(data.message || t("toasts.saveSettingsError"));
      }
    } catch {
      setProfileError(t("toasts.networkError"));
    } finally {
      setProfileLoading(false);
    }
  };

  // Test notification
  const handleTestNotification = async () => {
    if (!("Notification" in window)) {
      alert(t("toasts.notificationsUnsupported"));
      return;
    }

    setTestingNotification(true);

    if (Notification.permission !== "granted") {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);

      if (permission !== "granted") {
        alert(t("toasts.permissionRequiredForTest"));
        setTestingNotification(false);
        return;
      }
    }

    // Show test notification
    new Notification(t("toasts.testNotificationTitle"), {
      body: t("toasts.testNotificationBody"),
      dir: "rtl",
      lang: "he",
    });

    setTimeout(() => setTestingNotification(false), 1000);
  };

  // Handle logo upload
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLogoLoading(true);
    setLogoError("");
    setSuccessMessage("");

    try {
      const formData = new FormData();
      formData.append("logo", file);

      const response = await fetch("/api/profile/logo", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setProfile((prev) => (prev ? { ...prev, logoUrl: data.logoUrl } : null));
        setSuccessMessage(t("toasts.logoUploaded"));
        setTimeout(() => setSuccessMessage(""), 3000);
      } else {
        setLogoError(data.message || t("toasts.uploadLogoError"));
      }
    } catch {
      setLogoError(t("toasts.networkError"));
    } finally {
      setLogoLoading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Handle logo removal
  const handleRemoveLogo = async () => {
    if (!confirm(t("toasts.removeLogoConfirm"))) return;

    setLogoLoading(true);
    setLogoError("");
    setSuccessMessage("");

    try {
      const response = await fetch("/api/profile/logo", {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        setProfile((prev) => (prev ? { ...prev, logoUrl: null } : null));
        setSuccessMessage(t("toasts.logoRemoved"));
        setTimeout(() => setSuccessMessage(""), 3000);
      } else {
        setLogoError(data.message || t("toasts.removeLogoError"));
      }
    } catch {
      setLogoError(t("toasts.networkError"));
    } finally {
      setLogoLoading(false);
    }
  };

  // Handle signature upload
  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSignatureLoading(true);
    setSignatureError("");
    setSuccessMessage("");

    try {
      const formData = new FormData();
      formData.append("signature", file);

      const response = await fetch("/api/profile/signature", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setProfile((prev) => (prev ? { ...prev, signatureUrl: data.signatureUrl } : null));
        setSuccessMessage(t("toasts.signatureUploaded"));
        setTimeout(() => setSuccessMessage(""), 3000);
      } else {
        setSignatureError(data.message || t("toasts.uploadSignatureError"));
      }
    } catch {
      setSignatureError(t("toasts.networkError"));
    } finally {
      setSignatureLoading(false);
      // Reset file input
      if (signatureInputRef.current) {
        signatureInputRef.current.value = "";
      }
    }
  };

  // Handle signature removal
  const handleRemoveSignature = async () => {
    if (!confirm(t("toasts.removeSignatureConfirm"))) return;

    setSignatureLoading(true);
    setSignatureError("");
    setSuccessMessage("");

    try {
      const response = await fetch("/api/profile/signature", {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        setProfile((prev) => (prev ? { ...prev, signatureUrl: null } : null));
        setSuccessMessage(t("toasts.signatureRemoved"));
        setTimeout(() => setSuccessMessage(""), 3000);
      } else {
        setSignatureError(data.message || t("toasts.removeSignatureError"));
      }
    } catch {
      setSignatureError(t("toasts.networkError"));
    } finally {
      setSignatureLoading(false);
    }
  };

  // Fetch currency rates
  const fetchCurrencyRates = async () => {
    setLoading(true);
    setRateError("");
    try {
      const response = await fetch("/api/currency-rates");
      const data = await response.json();

      if (data.success) {
        setCurrencyRates(data.rates || []);
      } else {
        setRateError(data.message || t("toasts.loadRatesError"));
      }
    } catch {
      setRateError(t("toasts.networkError"));
    } finally {
      setLoading(false);
    }
  };

  // Save currency rate
  const handleSaveRate = async (e: React.FormEvent) => {
    e.preventDefault();
    setRateSaving(true);
    setRateError("");
    setRateSuccess("");

    try {
      const response = await fetch("/api/currency-rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromCurrency,
          toCurrency,
          rate: parseFloat(rate),
        }),
      });

      const data = await response.json();

      if (data.success) {
        setRateSuccess(t("toasts.rateSaved"));
        setTimeout(() => setRateSuccess(""), 3000);
        // Refresh rates list
        fetchCurrencyRates();
        // Reset form
        setFromCurrency("USD");
        setToCurrency("ILS");
        setRate("");
      } else {
        setRateError(data.message || t("toasts.saveRateError"));
      }
    } catch {
      setRateError(t("toasts.networkError"));
    } finally {
      setRateSaving(false);
    }
  };

  // Delete currency rate
  const handleDeleteRate = async (rateId: string) => {
    if (!confirm(t("toasts.deleteRateConfirm"))) return;

    setRateError("");
    setRateSuccess("");

    try {
      const response = await fetch("/api/currency-rates", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rateId }),
      });

      const data = await response.json();

      if (data.success) {
        setRateSuccess(t("toasts.rateDeleted"));
        setTimeout(() => setRateSuccess(""), 3000);
        // Refresh rates list
        fetchCurrencyRates();
      } else {
        setRateError(data.message || t("toasts.deleteRateError"));
      }
    } catch {
      setRateError(t("toasts.networkError"));
    }
  };

  const getCurrencySymbol = (currency: string) => {
    switch (currency) {
      case "ILS":
        return "₪";
      case "USD":
        return "$";
      case "USDT":
        return "₮";
      case "BTC":
        return "₿";
      case "ETH":
        return "Ξ";
      default:
        return currency;
    }
  };

  return (
    <AppLayout>
      <PageContainer maxWidth="max-w-3xl">
        <PageHeader title={t("pageTitle")} />

        {/* Tabs */}
        <div className="mb-8">
          <nav className="flex gap-2 flex-wrap" role="tablist">
            <button
              onClick={() => setActiveTab("profile")}
              className={`px-4 py-2 text-sm font-medium rounded-full transition-colors ${
                activeTab === "profile"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted"
              }`}
              role="tab"
              aria-selected={activeTab === "profile"}
            >
              {t("tabs.profile")}
            </button>
            <button
              onClick={() => setActiveTab("notifications")}
              className={`px-4 py-2 text-sm font-medium rounded-full transition-colors ${
                activeTab === "notifications"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted"
              }`}
              role="tab"
              aria-selected={activeTab === "notifications"}
            >
              {t("tabs.notifications")}
            </button>
            <button
              onClick={() => setActiveTab("currencies")}
              className={`px-4 py-2 text-sm font-medium rounded-full transition-colors ${
                activeTab === "currencies"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted"
              }`}
              role="tab"
              aria-selected={activeTab === "currencies"}
            >
              {t("tabs.currencies")}
            </button>
            <button
              onClick={() => setActiveTab("security")}
              className={`px-4 py-2 text-sm font-medium rounded-full transition-colors ${
                activeTab === "security"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted"
              }`}
              role="tab"
              aria-selected={activeTab === "security"}
            >
              {t("tabs.security")}
            </button>
          </nav>
        </div>

        {/* Currencies Tab Content */}
        {activeTab === "currencies" && (
          <div className="space-y-6" role="tabpanel">
            {/* Add Currency Rate Form */}
            <div className="bg-card rounded-[var(--radius-card)] border border-border p-6">
              <h2 className="font-display text-lg font-bold text-foreground mb-2">
                {t("currencies.addTitle")}
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                {t("currencies.addDescription")}
              </p>

              {rateError && (
                <div className="rounded-[var(--radius-card)] bg-destructive/10 p-4 mb-4">
                  <p className="text-sm text-destructive">{rateError}</p>
                </div>
              )}

              {rateSuccess && (
                <div className="rounded-[var(--radius-card)] bg-success/10 p-4 mb-4">
                  <p className="text-sm text-success">{rateSuccess}</p>
                </div>
              )}

              <form onSubmit={handleSaveRate} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* From Currency */}
                  <div>
                    <label
                      htmlFor="fromCurrency"
                      className="block text-sm font-medium text-muted-foreground mb-1"
                    >
                      {t("currencies.fromLabel")}
                    </label>
                    <select
                      id="fromCurrency"
                      value={fromCurrency}
                      onChange={(e) => setFromCurrency(e.target.value)}
                      className={fieldClass()}
                      disabled={rateSaving}
                    >
                      <option value="ILS">{t("currencyOptions.ILS")}</option>
                      <option value="USD">{t("currencyOptions.USD")}</option>
                      <option value="USDT">{t("currencyOptions.USDT")}</option>
                      <option value="BTC">{t("currencyOptions.BTC")}</option>
                      <option value="ETH">{t("currencyOptions.ETH")}</option>
                    </select>
                  </div>

                  {/* To Currency */}
                  <div>
                    <label
                      htmlFor="toCurrency"
                      className="block text-sm font-medium text-muted-foreground mb-1"
                    >
                      {t("currencies.toLabel")}
                    </label>
                    <select
                      id="toCurrency"
                      value={toCurrency}
                      onChange={(e) => setToCurrency(e.target.value)}
                      className={fieldClass()}
                      disabled={rateSaving}
                    >
                      <option value="ILS">{t("currencyOptions.ILS")}</option>
                      <option value="USD">{t("currencyOptions.USD")}</option>
                      <option value="USDT">{t("currencyOptions.USDT")}</option>
                      <option value="BTC">{t("currencyOptions.BTC")}</option>
                      <option value="ETH">{t("currencyOptions.ETH")}</option>
                    </select>
                  </div>

                  {/* Rate */}
                  <div>
                    <label
                      htmlFor="rate"
                      className="block text-sm font-medium text-muted-foreground mb-1"
                    >
                      {t("currencies.rateLabel")}
                    </label>
                    <input
                      type="number"
                      id="rate"
                      value={rate}
                      onChange={(e) => setRate(e.target.value)}
                      placeholder={t("currencies.ratePlaceholder")}
                      step="0.00000001"
                      min="0"
                      required
                      className={fieldClass()}
                      disabled={rateSaving}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("currencies.rateHint", {
                        to: getCurrencySymbol(toCurrency),
                        from: getCurrencySymbol(fromCurrency),
                      })}
                    </p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={rateSaving || fromCurrency === toCurrency}
                    className="px-6 py-2 bg-primary text-primary-foreground font-medium rounded-[var(--radius)] hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {rateSaving ? t("currencies.saving") : t("currencies.saveButton")}
                  </button>
                </div>
              </form>
            </div>

            {/* Existing Rates List */}
            <div className="bg-card rounded-[var(--radius-card)] border border-border p-6">
              <h2 className="font-display text-lg font-bold text-foreground mb-4">
                {t("currencies.listTitle")}
              </h2>

              {loading ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div>
                  <p className="mt-2 text-muted-foreground">{t("currencies.loadingRates")}</p>
                </div>
              ) : currencyRates.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  {t("currencies.emptyRates")}
                </p>
              ) : (
                <div className="space-y-4">
                  {currencyRates.map((rate) => (
                    <div
                      key={rate.id}
                      className="flex items-center justify-between p-4 rounded-[var(--radius-card)] border border-border bg-muted"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-lg font-semibold text-foreground">
                            {getCurrencySymbol(rate.fromCurrency)}
                          </span>
                          <span className="text-sm text-muted-foreground">({rate.fromCurrency})</span>
                        </div>
                        <svg
                          className="w-5 h-5 text-muted-foreground"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M14 5l7 7m0 0l-7 7m7-7H3"
                          />
                        </svg>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-lg font-semibold text-foreground">
                            {getCurrencySymbol(rate.toCurrency)}
                          </span>
                          <span className="text-sm text-muted-foreground">({rate.toCurrency})</span>
                        </div>
                        <span className="font-mono text-2xl font-bold text-accent">
                          {rate.rate}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDeleteRate(rate.id)}
                        className="px-3 py-1 text-destructive text-sm font-medium rounded hover:bg-destructive/10 transition-colors"
                      >
                        {t("currencies.delete")}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notifications Tab Content */}
        {activeTab === "notifications" && (
          <div className="space-y-6" role="tabpanel">
            {/* Notification Permission */}
            <div className="bg-card rounded-[var(--radius-card)] border border-border p-6">
              <h2 className="font-display text-lg font-bold text-foreground mb-2">
                {t("notifications.permissionTitle")}
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                {t("notifications.permissionDescription")}
              </p>

              <div className="flex items-center justify-between p-4 rounded-[var(--radius-card)] border border-border bg-muted">
                <div>
                  <p className="font-medium text-foreground">{t("notifications.permissionStatus")}</p>
                  <p className="text-sm text-muted-foreground">
                    {notificationPermission === "granted" && t("notifications.statusGranted")}
                    {notificationPermission === "denied" && t("notifications.statusDenied")}
                    {notificationPermission === "default" && t("notifications.statusDefault")}
                    {notificationPermission === null && t("notifications.statusUnsupported")}
                  </p>
                </div>
                <div className="flex gap-3">
                  {notificationPermission !== "granted" && notificationPermission !== null && (
                    <button
                      onClick={requestNotificationPermission}
                      className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-[var(--radius)] hover:bg-primary/90 transition-colors"
                    >
                      {t("notifications.enablePermission")}
                    </button>
                  )}
                  <button
                    onClick={handleTestNotification}
                    disabled={testingNotification || notificationPermission !== "granted"}
                    className="px-4 py-2 border border-border bg-card text-foreground text-sm font-medium rounded-[var(--radius)] hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {testingNotification ? t("notifications.sending") : t("notifications.testButton")}
                  </button>
                </div>
              </div>
            </div>

            {/* Long Timer Notification */}
            <div className="bg-card rounded-[var(--radius-card)] border border-border p-6">
              <h2 className="font-display text-lg font-bold text-foreground mb-2">
                {t("notifications.longTimerTitle")}
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                {t("notifications.longTimerDescription")}
              </p>

              {successMessage && activeTab === "notifications" && (
                <div className="rounded-[var(--radius-card)] bg-success/10 p-4 mb-4">
                  <p className="text-sm text-success">{successMessage}</p>
                </div>
              )}

              {profileError && activeTab === "notifications" && (
                <div className="rounded-[var(--radius-card)] bg-destructive/10 p-4 mb-4">
                  <p className="text-sm text-destructive">{profileError}</p>
                </div>
              )}

              <div className="space-y-6">
                {/* Enable/Disable */}
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">{t("notifications.longTimerToggle")}</label>
                    <p className="text-xs text-muted-foreground mt-1">{t("notifications.longTimerToggleHint")}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={longTimerEnabled}
                      onChange={(e) => setLongTimerEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:-translate-x-full peer-checked:after:border-primary-foreground after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-card after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                {/* Threshold */}
                {longTimerEnabled && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground block mb-2">
                      {t("notifications.thresholdLabel")}
                    </label>
                    <input
                      type="number"
                      value={longTimerThreshold}
                      onChange={(e) => setLongTimerThreshold(e.target.value)}
                      min="30"
                      max="480"
                      step="30"
                      className={fieldClass()}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("notifications.thresholdHint", {
                        minutes: parseInt(longTimerThreshold, 10),
                        hours: (parseInt(longTimerThreshold, 10) / 60).toFixed(1),
                      })}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Daily Reminder */}
            <div className="bg-card rounded-[var(--radius-card)] border border-border p-6">
              <h2 className="font-display text-lg font-bold text-foreground mb-2">
                {t("notifications.dailyReminderTitle")}
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                {t("notifications.dailyReminderDescription")}
              </p>

              <div className="space-y-6">
                {/* Enable/Disable */}
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">{t("notifications.dailyReminderToggle")}</label>
                    <p className="text-xs text-muted-foreground mt-1">{t("notifications.dailyReminderToggleHint")}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dailyReminderEnabled}
                      onChange={(e) => setDailyReminderEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:-translate-x-full peer-checked:after:border-primary-foreground after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-card after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                {/* Time */}
                {dailyReminderEnabled && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground block mb-2">
                      {t("notifications.reminderTimeLabel")}
                    </label>
                    <input
                      type="time"
                      value={dailyReminderTime}
                      onChange={(e) => setDailyReminderTime(e.target.value)}
                      className={fieldClass()}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("notifications.reminderTimeHint", { time: dailyReminderTime })}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Working Hours */}
            <div className="bg-card rounded-[var(--radius-card)] border border-border p-6">
              <h2 className="font-display text-lg font-bold text-foreground mb-2">
                {t("notifications.workingHoursTitle")}
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                {t("notifications.workingHoursDescription")}
              </p>

              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-2">
                  {t("notifications.workingHoursLabel")}
                </label>
                <input
                  type="number"
                  value={workingHours}
                  onChange={(e) => setWorkingHours(e.target.value)}
                  min="1"
                  max="24"
                  step="0.5"
                  className={fieldClass()}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t("notifications.workingHoursHint", { hours: workingHours })}
                </p>
              </div>
            </div>

            {/* First Day of Week */}
            <div className="bg-card rounded-[var(--radius-card)] border border-border p-6">
              <h2 className="font-display text-lg font-bold text-foreground mb-2">
                {t("notifications.firstDayTitle")}
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                {t("notifications.firstDayDescription")}
              </p>

              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-2">
                  {t("notifications.firstDayLabel")}
                </label>
                <select
                  value={firstDayOfWeek}
                  onChange={(e) => setFirstDayOfWeek(e.target.value)}
                  className={fieldClass()}
                >
                  <option value="sunday">{t("notifications.firstDaySunday")}</option>
                  <option value="monday">{t("notifications.firstDayMonday")}</option>
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  {firstDayOfWeek === "sunday" ? t("notifications.firstDayHintSunday") : t("notifications.firstDayHintMonday")}
                </p>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
              <button
                onClick={handleSaveNotificationSettings}
                disabled={profileLoading}
                className="px-6 py-2 bg-primary text-primary-foreground font-medium rounded-[var(--radius)] hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {profileLoading ? (
                  <span className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground border-t-transparent"></div>
                    {t("notifications.saving")}
                  </span>
                ) : (
                  t("notifications.saveButton")
                )}
              </button>
            </div>
          </div>
        )}

        {/* Security Tab Content */}
        {activeTab === "security" && (
          <div className="space-y-6" role="tabpanel">
            {/* Active Sessions Section */}
            <div className="bg-card rounded-[var(--radius-card)] border border-border p-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-display text-lg font-bold text-foreground">
                  {t("security.sessionsTitle")}
                </h2>
                {sessions.length > 1 && (
                  <button
                    onClick={() => setShowConfirmDialog(true)}
                    disabled={logoutAllLoading}
                    className="px-4 py-2 bg-destructive text-destructive-foreground text-sm font-medium rounded-[var(--radius)] hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {logoutAllLoading ? t("security.loggingOut") : t("security.logoutAll")}
                  </button>
                )}
              </div>
              <p className="text-sm text-muted-foreground mb-6">
                {t("security.sessionsDescription")}
              </p>

              {loading ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div>
                  <p className="mt-2 text-muted-foreground">{t("security.loadingSessions")}</p>
                </div>
              ) : error ? (
                <div className="rounded-[var(--radius-card)] bg-destructive/10 p-4">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              ) : sessions.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  {t("security.emptySessions")}
                </p>
              ) : (
                <div className="space-y-2.5">
                  {sessions.map((session) => (
                    <div
                      key={session.id}
                      className={`flex items-center gap-3 p-3.5 rounded-[var(--radius)] border ${
                        session.is_current
                          ? "border-accent/30 bg-accent/5"
                          : "border-border bg-muted"
                      }`}
                    >
                      <div className="w-9 h-9 rounded-full bg-card flex items-center justify-center shrink-0">
                        <svg
                          className="w-4 h-4 text-muted-foreground"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                          />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground flex items-center gap-2">
                          {getDeviceInfo(session.id)}
                          {session.is_current && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-accent/10 text-accent">
                              <span className="w-2 h-2 rounded-full bg-accent"></span>
                              {t("security.current")}
                            </span>
                          )}
                        </p>
                        <p className="font-mono text-xs text-muted-foreground mt-0.5">
                          {t("security.sessionMeta", {
                            created: formatDate(session.created_at),
                            expires: formatDate(session.expires_at),
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DeleteAccountSection />
          </div>
        )}

        {/* Profile Tab Content */}
        {activeTab === "profile" && (
          <div className="space-y-6" role="tabpanel">
            {/* Logo Upload Section */}
            <div className="bg-card rounded-[var(--radius-card)] border border-border p-5 sm:p-6">
              {logoError && (
                <div className="rounded-[var(--radius-card)] bg-destructive/10 p-4 mb-4">
                  <p className="text-sm text-destructive">{logoError}</p>
                </div>
              )}

              <div className="flex items-center justify-between gap-5">
                <div className="min-w-0">
                  <h2 className="font-display text-lg font-bold text-foreground">{t("profile.logoTitle")}</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t("profile.logoDescription")}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">{t("profile.logoFormats")}</p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {/* Logo Preview */}
                  <div className="w-16 h-16 rounded-full border-2 border-dashed border-border flex items-center justify-center bg-muted overflow-hidden">
                    {profile?.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={profile.logoUrl} alt={t("profile.logoAlt")} className="w-full h-full object-contain" />
                    ) : (
                      <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    )}
                  </div>

                  {/* Upload Actions */}
                  <div className="flex flex-col gap-1.5">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={logoLoading}
                      className="px-3 py-1.5 bg-primary text-primary-foreground text-sm font-medium rounded-[var(--radius)] hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                    >
                      {logoLoading ? t("profile.uploading") : profile?.logoUrl ? t("profile.replaceLogo") : t("profile.uploadLogo")}
                    </button>
                    {profile?.logoUrl && (
                      <button
                        onClick={handleRemoveLogo}
                        disabled={logoLoading}
                        className="px-3 py-1.5 text-destructive text-sm font-medium rounded-[var(--radius)] hover:bg-destructive/10 disabled:opacity-50 transition-colors whitespace-nowrap"
                      >
                        {t("profile.removeLogo")}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Signature Upload Section */}
            <div className="bg-card rounded-[var(--radius-card)] border border-border p-5 sm:p-6">
              {signatureError && (
                <div className="rounded-[var(--radius-card)] bg-destructive/10 p-4 mb-4">
                  <p className="text-sm text-destructive">{signatureError}</p>
                </div>
              )}

              <div className="flex items-center justify-between gap-5">
                <div className="min-w-0">
                  <h2 className="font-display text-lg font-bold text-foreground">{t("profile.signatureTitle")}</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t("profile.signatureDescription")}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">{t("profile.signatureFormats")}</p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {/* Signature Preview */}
                  <div className="w-28 h-16 rounded-[var(--radius)] border-2 border-dashed border-border flex items-center justify-center bg-muted overflow-hidden">
                    {profile?.signatureUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={profile.signatureUrl} alt={t("profile.signatureAlt")} className="w-full h-full object-contain" />
                    ) : (
                      <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    )}
                  </div>

                  {/* Upload Actions */}
                  <div className="flex flex-col gap-1.5">
                    <input
                      ref={signatureInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      onChange={handleSignatureUpload}
                      className="hidden"
                    />
                    <button
                      onClick={() => signatureInputRef.current?.click()}
                      disabled={signatureLoading}
                      className="px-3 py-1.5 bg-primary text-primary-foreground text-sm font-medium rounded-[var(--radius)] hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                    >
                      {signatureLoading ? t("profile.uploading") : profile?.signatureUrl ? t("profile.replaceSignature") : t("profile.uploadSignature")}
                    </button>
                    {profile?.signatureUrl && (
                      <button
                        onClick={handleRemoveSignature}
                        disabled={signatureLoading}
                        className="px-3 py-1.5 text-destructive text-sm font-medium rounded-[var(--radius)] hover:bg-destructive/10 disabled:opacity-50 transition-colors whitespace-nowrap"
                      >
                        {t("profile.removeSignature")}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Business Details Form */}
            <div className="bg-card rounded-[var(--radius-card)] border border-border p-6">
              <h2 className="font-display text-lg font-bold text-foreground mb-2">
                {t("business.title")}
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                {t("business.description")}
              </p>

              {profileError && (
                <div className="rounded-[var(--radius-card)] bg-destructive/10 p-4 mb-4">
                  <p className="text-sm text-destructive">{profileError}</p>
                </div>
              )}

              {successMessage && (
                <div className="rounded-[var(--radius-card)] bg-success/10 p-4 mb-4">
                  <p className="text-sm text-success">{successMessage}</p>
                </div>
              )}

              {loading ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div>
                  <p className="mt-2 text-muted-foreground">{t("business.loading")}</p>
                </div>
              ) : (
                <form onSubmit={handleSaveProfile} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Business Name */}
                    <div>
                      <label
                        htmlFor="businessName"
                        className="block text-sm font-medium text-muted-foreground mb-1"
                      >
                        {t("business.businessName")}
                      </label>
                      <input
                        type="text"
                        id="businessName"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder={t("business.businessNamePlaceholder")}
                        className={fieldClass()}
                      />
                    </div>

                    {/* Phone */}
                    <div>
                      <label
                        htmlFor="phone"
                        className="block text-sm font-medium text-muted-foreground mb-1"
                      >
                        {t("business.phone")}
                      </label>
                      <input
                        type="tel"
                        id="phone"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder={t("business.phonePlaceholder")}
                        className={fieldClass()}
                      />
                    </div>

                    {/* Email */}
                    <div>
                      <label
                        htmlFor="email"
                        className="block text-sm font-medium text-muted-foreground mb-1"
                      >
                        {t("business.email")}
                      </label>
                      <input
                        type="email"
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={t("business.emailPlaceholder")}
                        className={fieldClass()}
                      />
                    </div>

                    {/* Tax ID */}
                    <div>
                      <label
                        htmlFor="taxId"
                        className="block text-sm font-medium text-muted-foreground mb-1"
                      >
                        {t("business.taxId")}
                      </label>
                      <input
                        type="text"
                        id="taxId"
                        value={taxId}
                        onChange={(e) => setTaxId(e.target.value)}
                        placeholder={t("business.taxIdPlaceholder")}
                        className={fieldClass()}
                      />
                    </div>

                    {/* Website */}
                    <div>
                      <label
                        htmlFor="website"
                        className="block text-sm font-medium text-muted-foreground mb-1"
                      >
                        {t("business.website")}
                      </label>
                      <input
                        type="url"
                        id="website"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        placeholder={t("business.websitePlaceholder")}
                        className={fieldClass()}
                      />
                    </div>

                    {/* Address */}
                    <div className="md:col-span-2">
                      <label
                        htmlFor="address"
                        className="block text-sm font-medium text-muted-foreground mb-1"
                      >
                        {t("business.address")}
                      </label>
                      <textarea
                        id="address"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder={t("business.addressPlaceholder")}
                        rows={3}
                        className={`${fieldClass()} resize-none`}
                      />
                    </div>

                    {/* Default Currency */}
                    <div>
                      <label
                        htmlFor="defaultCurrency"
                        className="block text-sm font-medium text-muted-foreground mb-1"
                      >
                        {t("business.defaultCurrency")}
                      </label>
                      <select
                        id="defaultCurrency"
                        value={defaultCurrency}
                        onChange={(e) => setDefaultCurrency(e.target.value)}
                        className={fieldClass()}
                      >
                        <option value="ILS">{t("currencyOptions.ILS")}</option>
                        <option value="USD">{t("currencyOptions.USD")}</option>
                        <option value="USDT">{t("currencyOptions.USDT")}</option>
                        <option value="BTC">{t("currencyOptions.BTC")}</option>
                        <option value="ETH">{t("currencyOptions.ETH")}</option>
                      </select>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("business.defaultCurrencyHint")}
                      </p>
                    </div>

                    {/* Preferred PDF Template */}
                    <div>
                      <label
                        htmlFor="preferredPdfTemplate"
                        className="block text-sm font-medium text-muted-foreground mb-1"
                      >
                        {t("pdf.templateLabel")}
                      </label>
                      <select
                        id="preferredPdfTemplate"
                        value={preferredPdfTemplate}
                        onChange={(e) => setPreferredPdfTemplate(e.target.value)}
                        className={fieldClass()}
                      >
                        <option value="modern">{t("pdf.templateModern")}</option>
                        <option value="classic">{t("pdf.templateClassic")}</option>
                        <option value="bold">{t("pdf.templateBold")}</option>
                        <option value="elegant">{t("pdf.templateElegant")}</option>
                        <option value="nature">{t("pdf.templateNature")}</option>
                        <option value="ocean">{t("pdf.templateOcean")}</option>
                      </select>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("pdf.templateHint")}
                      </p>
                    </div>

                    {/* PDF Primary Color */}
                    <div>
                      <label
                        htmlFor="pdfPrimaryColor"
                        className="block text-sm font-medium text-muted-foreground mb-1"
                      >
                        {t("pdf.primaryColorLabel")}
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          id="pdfPrimaryColor"
                          value={pdfPrimaryColor}
                          onChange={(e) => setPdfPrimaryColor(e.target.value)}
                          className="h-10 w-20 border border-border rounded-[var(--radius)] cursor-pointer bg-card"
                        />
                        <input
                          type="text"
                          value={pdfPrimaryColor}
                          onChange={(e) => setPdfPrimaryColor(e.target.value)}
                          placeholder="#A8622D"
                          className={`${fieldClass()} flex-1 font-mono`}
                          pattern="^#[0-9A-Fa-f]{6}$"
                          maxLength={7}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("pdf.primaryColorHint")}
                      </p>
                    </div>

                    {/* PDF Accent Color */}
                    <div>
                      <label
                        htmlFor="pdfAccentColor"
                        className="block text-sm font-medium text-muted-foreground mb-1"
                      >
                        {t("pdf.accentColorLabel")}
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          id="pdfAccentColor"
                          value={pdfAccentColor}
                          onChange={(e) => setPdfAccentColor(e.target.value)}
                          className="h-10 w-20 border border-border rounded-[var(--radius)] cursor-pointer bg-card"
                        />
                        <input
                          type="text"
                          value={pdfAccentColor}
                          onChange={(e) => setPdfAccentColor(e.target.value)}
                          placeholder="#347B52"
                          className={`${fieldClass()} flex-1 font-mono`}
                          pattern="^#[0-9A-Fa-f]{6}$"
                          maxLength={7}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("pdf.accentColorHint")}
                      </p>
                    </div>

                    {/* Date Format */}
                    <div>
                      <label
                        htmlFor="dateFormat"
                        className="block text-sm font-medium text-muted-foreground mb-1"
                      >
                        {t("display.dateFormatLabel")}
                      </label>
                      <select
                        id="dateFormat"
                        value={dateFormat}
                        onChange={(e) => setDateFormat(e.target.value)}
                        className={fieldClass()}
                      >
                        <option value="DD/MM/YYYY">{t("display.dateFormatDMY")}</option>
                        <option value="MM/DD/YYYY">{t("display.dateFormatMDY")}</option>
                        <option value="YYYY-MM-DD">{t("display.dateFormatYMD")}</option>
                      </select>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("display.dateFormatHint")}
                      </p>
                    </div>

                    {/* Time Format */}
                    <div>
                      <label
                        htmlFor="timeFormat"
                        className="block text-sm font-medium text-muted-foreground mb-1"
                      >
                        {t("display.timeFormatLabel")}
                      </label>
                      <select
                        id="timeFormat"
                        value={timeFormat}
                        onChange={(e) => setTimeFormat(e.target.value)}
                        className={fieldClass()}
                      >
                        <option value="24h">{t("display.timeFormat24h")}</option>
                        <option value="12h">{t("display.timeFormat12h")}</option>
                      </select>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("display.timeFormatHint")}
                      </p>
                    </div>

                    {/* Invoice Prefix */}
                    <div>
                      <label
                        htmlFor="invoicePrefix"
                        className="block text-sm font-medium text-muted-foreground mb-1"
                      >
                        {t("invoice.prefixLabel")}
                      </label>
                      <input
                        type="text"
                        id="invoicePrefix"
                        value={invoicePrefix}
                        onChange={(e) => setInvoicePrefix(e.target.value)}
                        placeholder={t("invoice.prefixPlaceholder")}
                        className={fieldClass()}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("invoice.prefixHint")}
                      </p>
                    </div>

                    {/* Next Invoice Number */}
                    <div>
                      <label
                        htmlFor="nextInvoiceNumber"
                        className="block text-sm font-medium text-muted-foreground mb-1"
                      >
                        {t("invoice.nextNumberLabel")}
                      </label>
                      <input
                        type="number"
                        id="nextInvoiceNumber"
                        value={nextInvoiceNumber}
                        onChange={(e) => setNextInvoiceNumber(e.target.value)}
                        placeholder={t("invoice.nextNumberPlaceholder")}
                        min="1"
                        className={fieldClass()}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("invoice.nextNumberHint")}
                      </p>
                    </div>

                    {/* Payment Terms */}
                    <div className="md:col-span-2">
                      <label
                        htmlFor="paymentTerms"
                        className="block text-sm font-medium text-muted-foreground mb-1"
                      >
                        {t("invoice.paymentTermsLabel")}
                      </label>
                      <textarea
                        id="paymentTerms"
                        value={paymentTerms}
                        onChange={(e) => setPaymentTerms(e.target.value)}
                        placeholder={t("invoice.paymentTermsPlaceholder")}
                        rows={3}
                        className={`${fieldClass()} resize-none`}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("invoice.paymentTermsHint")}
                      </p>
                    </div>
                  </div>

                  {/* Bank Details Section */}
                  <div className="border-t border-border pt-6 mt-6">
                    <h3 className="text-lg font-semibold text-foreground mb-4">{t("business.bankSectionTitle")}</h3>
                    <p className="text-sm text-muted-foreground mb-6">
                      {t("business.bankSectionDescription")}
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Bank Name */}
                      <div>
                        <label
                          htmlFor="bankName"
                          className="block text-sm font-medium text-muted-foreground mb-1"
                        >
                          {t("business.bankName")}
                        </label>
                        <input
                          type="text"
                          id="bankName"
                          value={bankName}
                          onChange={(e) => setBankName(e.target.value)}
                          placeholder={t("business.bankNamePlaceholder")}
                          className={fieldClass()}
                        />
                      </div>

                      {/* Bank Branch */}
                      <div>
                        <label
                          htmlFor="bankBranch"
                          className="block text-sm font-medium text-muted-foreground mb-1"
                        >
                          {t("business.bankBranch")}
                        </label>
                        <input
                          type="text"
                          id="bankBranch"
                          value={bankBranch}
                          onChange={(e) => setBankBranch(e.target.value)}
                          placeholder={t("business.bankBranchPlaceholder")}
                          className={fieldClass()}
                        />
                      </div>

                      {/* Bank Account Number */}
                      <div>
                        <label
                          htmlFor="bankAccountNumber"
                          className="block text-sm font-medium text-muted-foreground mb-1"
                        >
                          {t("business.bankAccountNumber")}
                        </label>
                        <input
                          type="text"
                          id="bankAccountNumber"
                          value={bankAccountNumber}
                          onChange={(e) => setBankAccountNumber(e.target.value)}
                          placeholder={t("business.bankAccountNumberPlaceholder")}
                          className={fieldClass()}
                        />
                      </div>

                      {/* Bank Swift / BIC */}
                      <div>
                        <label
                          htmlFor="bankSwift"
                          className="block text-sm font-medium text-muted-foreground mb-1"
                        >
                          {t("business.bankSwift")}
                        </label>
                        <input
                          type="text"
                          id="bankSwift"
                          value={bankSwift}
                          onChange={(e) => setBankSwift(e.target.value)}
                          placeholder={t("business.bankSwiftPlaceholder")}
                          className={fieldClass()}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          {t("business.bankSwiftHint")}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={profileLoading}
                      className="px-6 py-2 bg-primary text-primary-foreground font-medium rounded-[var(--radius)] hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {profileLoading ? (
                        <span className="flex items-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground border-t-transparent"></div>
                          {t("business.saving")}
                        </span>
                      ) : (
                        t("business.saveButton")
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

      </PageContainer>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card rounded-[var(--radius-card)] border border-border-strong p-6 max-w-md w-full mx-4 motion-safe:animate-scale-in" dir="rtl">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              {t("security.confirmTitle")}
            </h3>
            <p className="text-muted-foreground mb-6">
              {t("security.confirmDescription")}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirmDialog(false)}
                disabled={logoutAllLoading}
                className="px-4 py-2 border border-border bg-card text-foreground rounded-[var(--radius)] hover:bg-muted disabled:opacity-50 transition-colors"
              >
                {t("security.cancel")}
              </button>
              <button
                onClick={handleLogoutAll}
                disabled={logoutAllLoading}
                className="px-4 py-2 bg-destructive text-destructive-foreground rounded-[var(--radius)] hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {logoutAllLoading ? t("security.loggingOut") : t("security.logoutAll")}
              </button>
            </div>
          </div>
        </div>
      )}

    </AppLayout>
  );
}
