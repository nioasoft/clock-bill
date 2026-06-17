"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter, usePathname, Link } from "@/src/i18n/navigation";
import { DashboardCustomizer } from "@/components/dashboard-customizer";
import { PdfPreview } from "@/components/pdf-preview";
import { MessageSquare, Bell, BellOff, CheckCircle2, XCircle, Clock, LogOut } from "lucide-react";
import { authClient } from "@/lib/auth/client";
import { DeleteAccountSection } from "@/components/delete-account-section";
import { AppLayout } from "@/components/app-layout";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { fieldClass } from "@/lib/form-styles";
import { SimpleSelect } from "@/components/ui/simple-select";
import { Tabs } from "@/components/ui/tabs";
import { messageForError } from "@/lib/api-error";
import { ROUNDING_MODES } from "@/lib/rounding";
import { THEMES } from "@/lib/themes";
import { useTheme } from "@/components/theme-provider";
import { subscribeToPush, unsubscribeFromPush } from "@/lib/push-client";

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
  const tNav = useTranslations("Nav");
  const tRoot = useTranslations();
  const tRounding = useTranslations("Rounding");
  const locale = useLocale();
  const isHebrew = locale !== "en";
  const intlLocale = locale === "en" ? "en-US" : "he-IL";
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<"profile" | "appearance" | "account">("profile");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [currencyRates, setCurrencyRates] = useState<CurrencyRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  // Per-section save state (Profile & Business is split into independent
  // save cards): which section is currently saving + the last result.
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [sectionResult, setSectionResult] = useState<{ section: string; ok: boolean } | null>(null);
  const [logoLoading, setLogoLoading] = useState(false);
  const [signatureLoading, setSignatureLoading] = useState(false);
  const [error, setError] = useState("");
  const [profileError, setProfileError] = useState("");
  const [logoError, setLogoError] = useState("");
  const [signatureError, setSignatureError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [logoutAllLoading, setLogoutAllLoading] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [exportingData, setExportingData] = useState(false);
  const [exportError, setExportError] = useState("");

  // Billing / subscription state — best-effort fetch of the current plan.
  const [billingPlan, setBillingPlan] = useState<{ tier: string; founding: boolean } | null>(null);
  const [billingError, setBillingError] = useState("");
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
  const [addressStreet, setAddressStreet] = useState("");
  const [addressCity, setAddressCity] = useState("");
  const [taxId, setTaxId] = useState("");
  const [website, setWebsite] = useState("");
  const [defaultCurrency, setDefaultCurrency] = useState("ILS");
  const [preferredPdfTemplate, setPreferredPdfTemplate] = useState("modern");
  const [defaultRate, setDefaultRate] = useState<string>("");
  const [defaultBillingRounding, setDefaultBillingRounding] = useState<string>("none");
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

  // Deep-link support: /settings?tab=dashboard (used by the dashboard's
  // "Customize" button). Read from the URL on mount client-side — avoids the
  // useSearchParams() static-prerender Suspense requirement. Only known tabs.
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab");
    // Map legacy/sub-section deep-links onto the consolidated tabs.
    const remap: Record<string, typeof activeTab> = {
      profile: "profile",
      appearance: "appearance",
      dashboard: "appearance",
      account: "account",
      notifications: "account",
      currencies: "profile",
      security: "account",
      billing: "account",
    };
    if (requested && remap[requested]) {
      setActiveTab(remap[requested]);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "profile") {
      // Profile & Business: business profile + billing base + currency rates.
      fetchProfile();
      fetchCurrencyRates();
    } else if (activeTab === "account") {
      // Account: subscription + notifications + sessions.
      fetchBillingPlan();
      fetchProfile();
      fetchSessions();
      checkNotificationPermission();
    }
    // "appearance" needs no fetch (theme is local; DashboardCustomizer self-loads).
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
      // Register this browser for Web Push so reminders/long-timer alerts arrive
      // even when the app is closed (and on installed iOS PWAs).
      await subscribeToPush();
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
        // Structured address. Legacy fallback: if street/city were never set
        // but a single-line address exists, seed the street field so existing
        // users don't appear to lose their address (re-saving recomposes it).
        {
          const street = data.profile.addressStreet || "";
          const city = data.profile.addressCity || "";
          if (!street && !city && data.profile.address) {
            setAddressStreet(data.profile.address);
            setAddressCity("");
          } else {
            setAddressStreet(street);
            setAddressCity(city);
          }
        }
        setTaxId(data.profile.taxId || "");
        setWebsite(data.profile.website || "");
        setDefaultCurrency(data.profile.defaultCurrency || "ILS");
        setPreferredPdfTemplate(data.profile.preferredPdfTemplate || "modern");
        setDefaultRate(data.profile.defaultRate != null ? String(data.profile.defaultRate) : "");
        setDefaultBillingRounding(data.profile.defaultBillingRounding || "none");
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
        setProfileError(data.error_code ? messageForError(data, tRoot) : t("toasts.loadProfileError"));
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
        setError(data.error_code ? messageForError(data, tRoot) : t("toasts.loadSessionsError"));
      }
    } catch {
      setError(t("toasts.networkError"));
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString(intlLocale, {
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

  // Log out the current device. Logout lives here (Settings) rather than as a
  // top-level top-bar action on mobile.
  const handleLogout = async () => {
    setLogoutLoading(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      const data = await response.json();
      if (data.success) {
        router.push("/login");
        router.refresh();
      } else {
        setError(t("toasts.networkError"));
      }
    } catch {
      setError(t("toasts.networkError"));
    } finally {
      setLogoutLoading(false);
    }
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
        setError(data.error_code ? messageForError(data, tRoot) : t("toasts.logoutAllError"));
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
          defaultRate: defaultRate.trim() === "" ? null : Number(defaultRate),
          defaultBillingRounding,
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
        setProfileError(data.error_code ? messageForError(data, tRoot) : t("toasts.saveProfileError"));
      }
    } catch {
      setProfileError(t("toasts.networkError"));
    } finally {
      setProfileLoading(false);
    }
  };

  // Save a single Profile & Business section (partial PATCH). Each card passes
  // only its own fields; feedback is tracked per-section so the success tick /
  // error shows on the right card.
  const saveSection = async (section: string, fields: Record<string, unknown>) => {
    setSavingSection(section);
    setSectionResult(null);
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      const data = await response.json();
      if (data.success) {
        setProfile(data.profile);
        setSectionResult({ section, ok: true });
        setTimeout(() => setSectionResult((r) => (r?.section === section ? null : r)), 3000);
      } else {
        setSectionResult({ section, ok: false });
      }
    } catch {
      setSectionResult({ section, ok: false });
    } finally {
      setSavingSection(null);
    }
  };

  // Compose the legacy single-line address from the structured fields, so the
  // value printed on invoices/reports (profile.address) stays correct.
  const composedAddress = (): string =>
    [addressStreet.trim(), addressCity.trim()].filter(Boolean).join(", ");

  // Save button + inline result, shared by the Profile & Business cards.
  const sectionSaveRow = (section: string) => (
    <div className="flex items-center justify-end gap-3 pt-1">
      {sectionResult?.section === section && (
        <span className={`text-sm ${sectionResult.ok ? "text-success" : "text-destructive"}`}>
          {sectionResult.ok ? t("toasts.profileSaved") : t("toasts.saveProfileError")}
        </span>
      )}
      <button
        type="submit"
        disabled={savingSection === section}
        className="px-5 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-[var(--radius)] hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {savingSection === section ? t("business.saving") : t("business.saveButton")}
      </button>
    </div>
  );

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
        // Keep the Web Push subscription in sync with the toggles: drop it when
        // both alerts are off, (re)register it when at least one is on.
        if (!longTimerEnabled && !dailyReminderEnabled) {
          await unsubscribeFromPush();
        } else if (notificationPermission === "granted") {
          await subscribeToPush();
        }
        setSuccessMessage(t("toasts.notificationSettingsSaved"));
        setTimeout(() => setSuccessMessage(""), 3000);
      } else {
        setProfileError(data.error_code ? messageForError(data, tRoot) : t("toasts.saveSettingsError"));
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
        setLogoError(data.error_code ? messageForError(data, tRoot) : t("toasts.uploadLogoError"));
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
        setLogoError(data.error_code ? messageForError(data, tRoot) : t("toasts.removeLogoError"));
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
        setSignatureError(data.error_code ? messageForError(data, tRoot) : t("toasts.uploadSignatureError"));
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
        setSignatureError(data.error_code ? messageForError(data, tRoot) : t("toasts.removeSignatureError"));
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
        setRateError(data.error_code ? messageForError(data, tRoot) : t("toasts.loadRatesError"));
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
        setRateError(data.error_code ? messageForError(data, tRoot) : t("toasts.saveRateError"));
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
        setRateError(data.error_code ? messageForError(data, tRoot) : t("toasts.deleteRateError"));
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

  // Interface language. Persists the choice to the profile (drives transactional
  // email language + survives cookie loss) AND switches the UI immediately by
  // replacing the current route under the chosen locale (next-intl swaps the
  // prefix and sets NEXT_LOCALE, so the user stays on the same screen).
  const handleLocaleChange = (next: string) => {
    if (next !== "he" && next !== "en") return;
    if (next === locale) return;
    void fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: next }),
    }).catch(() => {
      // Non-fatal: the UI still switches; the preference can be re-saved later.
    });
    router.replace(pathname, { locale: next });
  };

  // Fetch the current subscription plan (best-effort; failures are non-fatal —
  // the panel simply shows nothing rather than blocking the settings page).
  const fetchBillingPlan = async () => {
    try {
      const response = await fetch("/api/account/plan");
      const data = await response.json();
      if (data.success && data.plan) {
        setBillingPlan({ tier: data.plan.tier, founding: !!data.plan.founding });
      }
    } catch {
      // Ignore — billingPlan stays null and the panel renders nothing.
    }
  };

  // Open the Polar-hosted customer portal so paid users can manage their subscription.
  const handleManageSubscription = async () => {
    setBillingError("");
    try {
      await authClient.customer.portal();
    } catch {
      setBillingError(t("toasts.networkError"));
    }
  };

  // GDPR data export — download all the user's data as a single JSON file.
  // Uses fetch→blob so a failed request surfaces an error instead of navigating
  // the browser to a raw error page.
  const handleExportData = async () => {
    setExportingData(true);
    setExportError("");
    try {
      const response = await fetch("/api/account/export");
      if (!response.ok) {
        setExportError(t("data.exportError"));
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const today = new Date().toISOString().slice(0, 10);
      link.download = `clockbill-data-export-${today}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setExportError(t("data.exportError"));
    } finally {
      setExportingData(false);
    }
  };

  return (
    <AppLayout>
      <PageContainer maxWidth="max-w-3xl">
        <PageHeader title={t("pageTitle")} />

        {/* Tabs */}
        <div className="mb-8">
          <Tabs
            ariaLabel={t("pageTitle")}
            active={activeTab}
            onChange={(k) => setActiveTab(k as typeof activeTab)}
            tabs={[
              { key: "profile", label: t("tabs.profile") },
              { key: "appearance", label: t("tabs.appearance") },
              { key: "account", label: t("tabs.account") },
            ]}
          />
        </div>

        {/* Tab panels — a flex column so consolidated tabs (which now hold
            several sections each) order their sections via order-* regardless
            of source position, avoiding large JSX moves. Only the active tab's
            panels render, so order values are per-tab. */}
        <div className="flex flex-col gap-6">

        {/* Currencies — moved under Profile & Business */}
        {activeTab === "profile" && (
          <div className="space-y-6 order-3" role="tabpanel">
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
                    <SimpleSelect
                      id="fromCurrency"
                      value={fromCurrency}
                      onChange={setFromCurrency}
                      disabled={rateSaving}
                      options={[
                        { value: "ILS", label: t("currencyOptions.ILS") },
                        { value: "USD", label: t("currencyOptions.USD") },
                        { value: "USDT", label: t("currencyOptions.USDT") },
                        { value: "BTC", label: t("currencyOptions.BTC") },
                        { value: "ETH", label: t("currencyOptions.ETH") },
                      ]}
                    />
                  </div>

                  {/* To Currency */}
                  <div>
                    <label
                      htmlFor="toCurrency"
                      className="block text-sm font-medium text-muted-foreground mb-1"
                    >
                      {t("currencies.toLabel")}
                    </label>
                    <SimpleSelect
                      id="toCurrency"
                      value={toCurrency}
                      onChange={setToCurrency}
                      disabled={rateSaving}
                      options={[
                        { value: "ILS", label: t("currencyOptions.ILS") },
                        { value: "USD", label: t("currencyOptions.USD") },
                        { value: "USDT", label: t("currencyOptions.USDT") },
                        { value: "BTC", label: t("currencyOptions.BTC") },
                        { value: "ETH", label: t("currencyOptions.ETH") },
                      ]}
                    />
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

        {/* Appearance Tab Content */}
        {activeTab === "appearance" && (
          <div className="space-y-6 order-1" role="tabpanel">
            <div className="bg-card rounded-[var(--radius-card)] border border-border p-6">
              <h2 className="font-display text-lg font-bold text-foreground mb-2">
                {t("appearance.title")}
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                {t("appearance.subtitle")}
              </p>

              <div className="grid grid-cols-2 gap-3">
                {THEMES.map((themeOption) => (
                  <button
                    key={themeOption.id}
                    type="button"
                    onClick={() => setTheme(themeOption.id)}
                    aria-pressed={theme === themeOption.id}
                    className={`flex items-center gap-3 rounded-[var(--radius-card)] border p-3 text-start transition-colors ${
                      theme === themeOption.id
                        ? "border-border-strong ring-2 ring-ring"
                        : "border-border hover:border-border-strong"
                    }`}
                  >
                    <span className="flex gap-1">
                      {themeOption.swatch.map((c, i) => (
                        <span
                          key={i}
                          style={{ background: c }}
                          className="size-5 rounded-full border border-border"
                        />
                      ))}
                    </span>
                    <span className="font-medium text-foreground">
                      {isHebrew ? themeOption.labelHe : themeOption.labelEn}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Dashboard layout — moved under Appearance */}
        {activeTab === "appearance" && (
          <div className="order-2" role="tabpanel">
            <DashboardCustomizer />
          </div>
        )}

        {/* Display preferences — date / time / language. Instant-save (no
            button), consistent with theme + dashboard above. */}
        {activeTab === "appearance" && (
          <div className="space-y-6 order-3" role="tabpanel">
            <div className="bg-card rounded-[var(--radius-card)] border border-border p-5 sm:p-6">
              <h2 className="font-display text-lg font-bold text-foreground mb-1">
                {t("display.sectionTitle")}
              </h2>
              <p className="text-sm text-muted-foreground mb-5">
                {t("display.sectionDescription")}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="dateFormat" className="block text-sm font-medium text-muted-foreground mb-1">
                    {t("display.dateFormatLabel")}
                  </label>
                  <SimpleSelect
                    id="dateFormat"
                    value={dateFormat}
                    onChange={(v) => { setDateFormat(v); saveSection("display", { dateFormat: v }); }}
                    options={[
                      { value: "DD/MM/YYYY", label: t("display.dateFormatDMY") },
                      { value: "MM/DD/YYYY", label: t("display.dateFormatMDY") },
                      { value: "YYYY-MM-DD", label: t("display.dateFormatYMD") },
                    ]}
                  />
                </div>
                <div>
                  <label htmlFor="timeFormat" className="block text-sm font-medium text-muted-foreground mb-1">
                    {t("display.timeFormatLabel")}
                  </label>
                  <SimpleSelect
                    id="timeFormat"
                    value={timeFormat}
                    onChange={(v) => { setTimeFormat(v); saveSection("display", { timeFormat: v }); }}
                    options={[
                      { value: "24h", label: t("display.timeFormat24h") },
                      { value: "12h", label: t("display.timeFormat12h") },
                    ]}
                  />
                </div>
                <div>
                  <label htmlFor="interfaceLanguage" className="block text-sm font-medium text-muted-foreground mb-1">
                    {t("display.language.label")}
                  </label>
                  <SimpleSelect
                    id="interfaceLanguage"
                    value={locale}
                    onChange={handleLocaleChange}
                    options={[
                      { value: "he", label: t("display.language.he") },
                      { value: "en", label: t("display.language.en") },
                    ]}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Notifications — moved under Account */}
        {activeTab === "account" && (
          <div className="space-y-6 order-2" role="tabpanel">
            {/* Notification Permission */}
            <div className="bg-card rounded-[var(--radius-card)] border border-border p-6">
              <h2 className="font-display text-lg font-bold text-foreground mb-2">
                {t("notifications.permissionTitle")}
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                {t("notifications.permissionDescription")}
              </p>

              {/* Status (read-only) — a semantic icon badge replaces the old inline
                  emoji so the state reads consistently across platforms. Kept
                  separate from the action below so the button still reads as a CTA. */}
              {(() => {
                const meta = {
                  granted: { Icon: CheckCircle2, badge: "bg-success/10 text-success", label: t("notifications.statusGranted") },
                  denied: { Icon: XCircle, badge: "bg-destructive/10 text-destructive", label: t("notifications.statusDenied") },
                  default: { Icon: Clock, badge: "bg-warning/10 text-warning", label: t("notifications.statusDefault") },
                  unsupported: { Icon: BellOff, badge: "bg-muted text-muted-foreground", label: t("notifications.statusUnsupported") },
                } as const;
                const key = notificationPermission === "granted" ? "granted"
                  : notificationPermission === "denied" ? "denied"
                  : notificationPermission === "default" ? "default"
                  : "unsupported";
                const { Icon, badge, label } = meta[key];
                return (
                  <div className="flex items-center gap-3 p-4 rounded-[var(--radius-card)] border border-border bg-muted/40">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${badge}`}>
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{t("notifications.permissionStatus")}</p>
                      <p className="text-sm text-muted-foreground">{label}</p>
                    </div>
                  </div>
                );
              })()}

              <div className="mt-3 flex flex-col sm:flex-row gap-3">
                {notificationPermission !== "granted" && notificationPermission !== null && (
                  <button
                    type="button"
                    onClick={requestNotificationPermission}
                    className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-[var(--radius)] hover:bg-primary/90 active:scale-[0.99] transition-all cursor-pointer"
                  >
                    <Bell className="h-4 w-4" aria-hidden="true" />
                    {t("notifications.enablePermission")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleTestNotification}
                  disabled={testingNotification || notificationPermission !== "granted"}
                  className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 border border-border bg-card text-foreground text-sm font-medium rounded-[var(--radius)] hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {testingNotification ? t("notifications.sending") : t("notifications.testButton")}
                </button>
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

              {successMessage && activeTab === "account" && (
                <div className="rounded-[var(--radius-card)] bg-success/10 p-4 mb-4">
                  <p className="text-sm text-success">{successMessage}</p>
                </div>
              )}

              {profileError && activeTab === "account" && (
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
                    <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/30 rounded-full peer peer-checked:rtl:after:-translate-x-full peer-checked:ltr:after:translate-x-full peer-checked:after:border-primary-foreground after:content-[''] after:absolute after:top-[2px] rtl:after:right-[2px] ltr:after:left-[2px] after:bg-card after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
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
                    <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/30 rounded-full peer peer-checked:rtl:after:-translate-x-full peer-checked:ltr:after:translate-x-full peer-checked:after:border-primary-foreground after:content-[''] after:absolute after:top-[2px] rtl:after:right-[2px] ltr:after:left-[2px] after:bg-card after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
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
                <SimpleSelect
                  value={firstDayOfWeek}
                  onChange={setFirstDayOfWeek}
                  aria-label={t("notifications.firstDayLabel")}
                  options={[
                    { value: "sunday", label: t("notifications.firstDaySunday") },
                    { value: "monday", label: t("notifications.firstDayMonday") },
                  ]}
                />
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

        {/* Subscription / plan — moved under Account */}
        {activeTab === "account" && (
          <div className="space-y-6 order-1" role="tabpanel">
            <div className="bg-card rounded-[var(--radius-card)] border border-border p-6">
              <h2 className="font-display text-lg font-bold text-foreground mb-6">
                {t("billing.heading")}
              </h2>

              {billingError && (
                <div className="rounded-[var(--radius-card)] bg-destructive/10 p-4 mb-4">
                  <p className="text-sm text-destructive">{billingError}</p>
                </div>
              )}

              {billingPlan === null ? (
                <div className="h-10 w-48 rounded-[var(--radius)] bg-muted animate-pulse" />
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 rounded-[var(--radius-card)] border border-border bg-muted">
                    <div>
                      <p className="text-sm text-muted-foreground">{t("billing.currentPlan")}</p>
                      <p className="font-medium text-foreground mt-0.5">
                        {billingPlan.tier === "unlimited"
                          ? t("billing.tierUnlimited")
                          : billingPlan.tier === "starter"
                            ? t("billing.tierStarter")
                            : t("billing.tierFree")}
                      </p>
                      {billingPlan.founding && (
                        <p className="text-xs text-accent mt-1">{t("billing.founding")}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Link
                      href="/pricing"
                      className="px-4 py-2 border border-border bg-card text-foreground text-sm font-medium rounded-[var(--radius)] hover:bg-muted transition-colors"
                    >
                      {t("billing.viewPlans")}
                    </Link>
                    {(billingPlan.tier === "starter" || billingPlan.tier === "unlimited") && (
                      <button
                        onClick={handleManageSubscription}
                        className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-[var(--radius)] hover:bg-primary/90 transition-colors"
                      >
                        {t("billing.manage")}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Default billing base (rate + rounding) — moved under Profile & Business */}
        {activeTab === "profile" && (
          <div className="space-y-6 order-2" role="tabpanel">
            <div className="bg-card rounded-[var(--radius-card)] border border-border p-6">
              <h2 className="font-display text-lg font-bold text-foreground mb-2">
                {t("billing.baseHeading")}
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                {t("billing.baseDescription")}
              </p>

              {successMessage && activeTab === "profile" && (
                <div className="rounded-[var(--radius-card)] bg-success/10 p-4 mb-4">
                  <p className="text-sm text-success">{successMessage}</p>
                </div>
              )}

              {profileError && activeTab === "profile" && (
                <div className="rounded-[var(--radius-card)] bg-destructive/10 p-4 mb-4">
                  <p className="text-sm text-destructive">{profileError}</p>
                </div>
              )}

              <form onSubmit={handleSaveProfile} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Default hourly rate */}
                  <div>
                    <label
                      htmlFor="defaultRate"
                      className="block text-sm font-medium text-muted-foreground mb-1"
                    >
                      {t("billing.defaultRateLabel")}
                    </label>
                    <input
                      id="defaultRate"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={defaultRate}
                      onChange={(e) => setDefaultRate(e.target.value)}
                      className={fieldClass()}
                    />
                  </div>

                  {/* Default billing rounding */}
                  <div>
                    <label
                      htmlFor="defaultBillingRounding"
                      className="block text-sm font-medium text-muted-foreground mb-1"
                    >
                      {t("billing.defaultRoundingLabel")}
                    </label>
                    <SimpleSelect
                      id="defaultBillingRounding"
                      value={defaultBillingRounding}
                      onChange={setDefaultBillingRounding}
                      options={ROUNDING_MODES.map((m) => ({
                        value: m,
                        label: tRounding(m),
                      }))}
                    />
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
            </div>
          </div>
        )}

        {/* Security & data — moved under Account */}
        {activeTab === "account" && (
          <div className="space-y-6 order-3" role="tabpanel">
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

            {/* Data & Privacy — GDPR data export (right of access / portability) */}
            <div className="bg-card rounded-[var(--radius-card)] border border-border p-6">
              <h2 className="font-display text-lg font-bold text-foreground mb-2">
                {t("data.title")}
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                {t("data.description")}
              </p>
              {exportError && (
                <div className="rounded-[var(--radius-card)] bg-destructive/10 p-4 mb-4">
                  <p className="text-sm text-destructive">{exportError}</p>
                </div>
              )}
              <button
                onClick={handleExportData}
                disabled={exportingData}
                className="px-4 py-2 border border-border bg-card text-foreground text-sm font-medium rounded-[var(--radius)] hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {exportingData ? t("data.exporting") : t("data.exportButton")}
              </button>
            </div>

            <DeleteAccountSection />
          </div>
        )}

        {/* Profile & Business — primary section of the Profile tab. Cards are a
            flex column so business details lead (order-1), then logo/signature. */}
        {activeTab === "profile" && (
          <div className="flex flex-col gap-6 order-1" role="tabpanel">
            {/* Logo Upload Section */}
            <div className="order-5 bg-card rounded-[var(--radius-card)] border border-border p-5 sm:p-6">
              {logoError && (
                <div className="rounded-[var(--radius-card)] bg-destructive/10 p-4 mb-4">
                  <p className="text-sm text-destructive">{logoError}</p>
                </div>
              )}

              {/* Stacked on mobile — side-by-side leaves the text a few words wide. */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
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
            <div className="order-6 bg-card rounded-[var(--radius-card)] border border-border p-5 sm:p-6">
              {signatureError && (
                <div className="rounded-[var(--radius-card)] bg-destructive/10 p-4 mb-4">
                  <p className="text-sm text-destructive">{signatureError}</p>
                </div>
              )}

              {/* Stacked on mobile — side-by-side leaves the text a few words wide. */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
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

            {/* Business identity card — saves independently */}
            <div className="order-1 bg-card rounded-[var(--radius-card)] border border-border p-5 sm:p-6">
              <h2 className="font-display text-lg font-bold text-foreground mb-2">
                {t("business.title")}
              </h2>
              <p className="text-sm text-muted-foreground mb-5">
                {t("business.description")}
              </p>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  saveSection("business", {
                    businessName: businessName || null,
                    phone: phone || null,
                    email: email || null,
                    taxId: taxId || null,
                    website: website || null,
                    defaultCurrency: defaultCurrency || null,
                    addressStreet: addressStreet || null,
                    addressCity: addressCity || null,
                    address: composedAddress() || null,
                  });
                }}
                className="space-y-5"
              >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        className={fieldClass()}
                      />
                    </div>

                    {/* Address — structured (street + city), small fields */}
                    <div>
                      <label
                        htmlFor="addressStreet"
                        className="block text-sm font-medium text-muted-foreground mb-1"
                      >
                        {t("business.addressStreet")}
                      </label>
                      <input
                        type="text"
                        id="addressStreet"
                        value={addressStreet}
                        onChange={(e) => setAddressStreet(e.target.value)}
                        className={fieldClass()}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="addressCity"
                        className="block text-sm font-medium text-muted-foreground mb-1"
                      >
                        {t("business.addressCity")}
                      </label>
                      <input
                        type="text"
                        id="addressCity"
                        value={addressCity}
                        onChange={(e) => setAddressCity(e.target.value)}
                        className={fieldClass()}
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
                      <SimpleSelect
                        id="defaultCurrency"
                        value={defaultCurrency}
                        onChange={setDefaultCurrency}
                        options={[
                          { value: "ILS", label: t("currencyOptions.ILS") },
                          { value: "USD", label: t("currencyOptions.USD") },
                          { value: "USDT", label: t("currencyOptions.USDT") },
                          { value: "BTC", label: t("currencyOptions.BTC") },
                          { value: "ETH", label: t("currencyOptions.ETH") },
                        ]}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("business.defaultCurrencyHint")}
                      </p>
                    </div>
                  </div>
                  {sectionSaveRow("business")}
                </form>
            </div>

            {/* PDF appearance card — saves independently, with a live preview */}
            <div className="order-2 bg-card rounded-[var(--radius-card)] border border-border p-5 sm:p-6">
              <h2 className="font-display text-lg font-bold text-foreground mb-1">{t("pdf.sectionTitle")}</h2>
              <p className="text-sm text-muted-foreground mb-5">{t("pdf.sectionDescription")}</p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  saveSection("pdf", {
                    preferredPdfTemplate: preferredPdfTemplate || null,
                    pdfPrimaryColor: pdfPrimaryColor || "#A8622D",
                    pdfAccentColor: pdfAccentColor || "#347B52",
                  });
                }}
                className="space-y-4"
              >
                  {/* Compact row: template + the two colors (swatch above,
                      hex below). Per-field hints dropped — the section
                      description already explains it. */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
                    {/* Default PDF template */}
                    <div>
                      <label
                        htmlFor="preferredPdfTemplate"
                        className="block text-sm font-medium text-muted-foreground mb-1"
                      >
                        {t("pdf.templateLabel")}
                      </label>
                      <SimpleSelect
                        id="preferredPdfTemplate"
                        value={preferredPdfTemplate}
                        onChange={setPreferredPdfTemplate}
                        options={[
                          { value: "modern", label: t("pdf.templateModern") },
                          { value: "classic", label: t("pdf.templateClassic") },
                          { value: "bold", label: t("pdf.templateBold") },
                          { value: "elegant", label: t("pdf.templateElegant") },
                          { value: "nature", label: t("pdf.templateNature") },
                          { value: "ocean", label: t("pdf.templateOcean") },
                        ]}
                      />
                    </div>

                    {/* Primary color */}
                    <div>
                      <label
                        htmlFor="pdfPrimaryColor"
                        className="block text-sm font-medium text-muted-foreground mb-1"
                      >
                        {t("pdf.primaryColorLabel")}
                      </label>
                      <input
                        type="color"
                        id="pdfPrimaryColor"
                        value={pdfPrimaryColor}
                        onChange={(e) => setPdfPrimaryColor(e.target.value)}
                        className="h-9 w-full rounded-[var(--radius)] border border-border cursor-pointer bg-card"
                      />
                      <input
                        type="text"
                        aria-label={t("pdf.primaryColorLabel")}
                        value={pdfPrimaryColor}
                        onChange={(e) => setPdfPrimaryColor(e.target.value)}
                        className={`${fieldClass()} mt-1 font-mono text-xs text-center`}
                        pattern="^#[0-9A-Fa-f]{6}$"
                        maxLength={7}
                      />
                    </div>

                    {/* Accent color */}
                    <div>
                      <label
                        htmlFor="pdfAccentColor"
                        className="block text-sm font-medium text-muted-foreground mb-1"
                      >
                        {t("pdf.accentColorLabel")}
                      </label>
                      <input
                        type="color"
                        id="pdfAccentColor"
                        value={pdfAccentColor}
                        onChange={(e) => setPdfAccentColor(e.target.value)}
                        className="h-9 w-full rounded-[var(--radius)] border border-border cursor-pointer bg-card"
                      />
                      <input
                        type="text"
                        aria-label={t("pdf.accentColorLabel")}
                        value={pdfAccentColor}
                        onChange={(e) => setPdfAccentColor(e.target.value)}
                        className={`${fieldClass()} mt-1 font-mono text-xs text-center`}
                        pattern="^#[0-9A-Fa-f]{6}$"
                        maxLength={7}
                      />
                    </div>
                  </div>
                  {sectionSaveRow("pdf")}
                </form>
                <div className="mt-5">
                  <PdfPreview
                    template={preferredPdfTemplate}
                    primaryColor={pdfPrimaryColor}
                    accentColor={pdfAccentColor}
                    businessName={businessName}
                    addressStreet={addressStreet}
                    addressCity={addressCity}
                    logoUrl={profile?.logoUrl ?? null}
                    label={t("pdf.previewLabel")}
                    docTitle={t("pdf.previewDocTitle")}
                  />
                </div>
            </div>

            {/* Bank details card — saves independently */}
            <div className="order-4 bg-card rounded-[var(--radius-card)] border border-border p-5 sm:p-6">
              <h2 className="font-display text-lg font-bold text-foreground mb-1">{t("business.bankSectionTitle")}</h2>
              <p className="text-sm text-muted-foreground mb-4">
                {t("business.bankSectionDescription")}
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  saveSection("bank", {
                    bankName: bankName || null,
                    bankBranch: bankBranch || null,
                    bankAccountNumber: bankAccountNumber || null,
                    bankSwift: bankSwift || null,
                  });
                }}
                className="space-y-5"
              >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                          className={fieldClass()}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          {t("business.bankSwiftHint")}
                        </p>
                      </div>
                    </div>
                  {sectionSaveRow("bank")}
                </form>
            </div>
          </div>
        )}

        </div>{/* end tab panels flex column */}

        {/* Feedback / support entry point. On mobile this is the only way to
            reach the feedback page (it was dropped from the bottom nav to make
            room), so it lives outside the tabs and is always visible. */}
        <div className="mt-6 bg-card rounded-[var(--radius-card)] border border-border p-5 sm:p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold text-foreground">{t("support.title")}</h2>
            <p className="text-sm text-muted-foreground mt-1">{t("support.description")}</p>
          </div>
          <Link
            href="/feedback"
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius)] border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors shrink-0"
          >
            <MessageSquare className="h-4 w-4" />
            {t("support.cta")}
          </Link>
        </div>

        {/* Logout — lives in Settings (it was removed from the mobile top bar,
            which now hosts the start-timer action instead). */}
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={handleLogout}
            disabled={logoutLoading}
            className="inline-flex items-center justify-center gap-2 rounded-[var(--radius)] px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            {logoutLoading ? tNav("loggingOut") : tNav("logout")}
          </button>
        </div>

      </PageContainer>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card rounded-[var(--radius-card)] border border-border-strong p-6 max-w-md w-full mx-4 motion-safe:animate-scale-in">
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
