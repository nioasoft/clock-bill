"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ImportContent } from "@/components/import-content";
import { AppLayout } from "@/components/app-layout";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";

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
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"profile" | "security" | "currencies" | "notifications" | "import">("profile");
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

  // Import state
  const [importType, setImportType] = useState<"clients" | "entries">("clients");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState("");
  const [importSuccess, setImportSuccess] = useState("");
  const [importResults, setImportResults] = useState<{ imported: number; errors?: Array<{ row: number; message: string }> } | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvPreview, setCsvPreview] = useState<Record<string, string>[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [showMappingStep, setShowMappingStep] = useState(false);
  const importClientsRef = useRef<HTMLInputElement>(null);
  const importEntriesRef = useRef<HTMLInputElement>(null);

  // JSON Backup/Restore state
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupError, setBackupError] = useState("");
  const [backupSuccess, setBackupSuccess] = useState("");
  const [backupImportResults, setBackupImportResults] = useState<{
    profile: number;
    clients: number;
    projects: number;
    timeEntries: number;
    customTags: number;
    currencyRates: number;
    tasks: number;
    errors: Array<{ entity: string; message: string }>;
  } | null>(null);
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const backupInputRef = useRef<HTMLInputElement>(null);

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
      alert("הדפדפן שלך לא תומך בהתראות");
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);

    if (permission === "granted") {
      setSuccessMessage("ההרשאה להתראות ניתנה בהצלחה!");
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
        setProfileError(data.message || "שגיאה בטעינת הפרופיל");
      }
    } catch {
      setProfileError("שגיאת תקשורת. אנא נסה שוב.");
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
        setError(data.message || "שגיאה בטעינת הפעולות");
      }
    } catch {
      setError("שגיאת תקשורת. אנא נסה שוב.");
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
    return `מכשיר ${sessionId.slice(0, 8)}`;
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
        setError(data.message || "שגיאה בהתנתקות מכל המכשירים");
        setShowConfirmDialog(false);
      }
    } catch {
      setError("שגיאת תקשורת. אנא נסה שוב.");
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
        setSuccessMessage("הפרטים נשמרו בהצלחה!");
        // Clear success message after 3 seconds
        setTimeout(() => setSuccessMessage(""), 3000);
      } else {
        setProfileError(data.message || "שגיאה בשמירת הפרטים");
      }
    } catch {
      setProfileError("שגיאת תקשורת. אנא נסה שוב.");
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
        setSuccessMessage("הגדרות ההתראות נשמרו בהצלחה!");
        setTimeout(() => setSuccessMessage(""), 3000);
      } else {
        setProfileError(data.message || "שגיאה בשמירת הגדרות");
      }
    } catch {
      setProfileError("שגיאת תקשורת. אנא נסה שוב.");
    } finally {
      setProfileLoading(false);
    }
  };

  // Test notification
  const handleTestNotification = async () => {
    if (!("Notification" in window)) {
      alert("הדפדפן שלך לא תומך בהתראות");
      return;
    }

    setTestingNotification(true);

    if (Notification.permission !== "granted") {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);

      if (permission !== "granted") {
        alert("נדרש אישור להתראות כדי לבדוק את הפונקציונליות");
        setTestingNotification(false);
        return;
      }
    }

    // Show test notification
    new Notification("בדיקת התראות - מוניט", {
      body: "זוהי התראת בדיקה מהמערכת. אם אתה רואה את ההודעה הזו, ההתראות עובדות כראוי!",
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
        setSuccessMessage("הלוגו הועלה בהצלחה!");
        setTimeout(() => setSuccessMessage(""), 3000);
      } else {
        setLogoError(data.message || "שגיאה בהעלאת הלוגו");
      }
    } catch {
      setLogoError("שגיאת תקשורת. אנא נסה שוב.");
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
    if (!confirm("האם אתה בטוח שברצונך להסיר את הלוגו?")) return;

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
        setSuccessMessage("הלוגו הוסר בהצלחה!");
        setTimeout(() => setSuccessMessage(""), 3000);
      } else {
        setLogoError(data.message || "שגיאה בהסרת הלוגו");
      }
    } catch {
      setLogoError("שגיאת תקשורת. אנא נסה שוב.");
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
        setSuccessMessage("החתימה הועלתה בהצלחה!");
        setTimeout(() => setSuccessMessage(""), 3000);
      } else {
        setSignatureError(data.message || "שגיאה בהעלאת החתימה");
      }
    } catch {
      setSignatureError("שגיאת תקשורת. אנא נסה שוב.");
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
    if (!confirm("האם אתה בטוח שברצונך להסיר את החתימה?")) return;

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
        setSuccessMessage("החתימה הוסרה בהצלחה!");
        setTimeout(() => setSuccessMessage(""), 3000);
      } else {
        setSignatureError(data.message || "שגיאה בהסרת החתימה");
      }
    } catch {
      setSignatureError("שגיאת תקשורת. אנא נסה שוב.");
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
        setRateError(data.message || "שגיאה בטעינת שערי חליפין");
      }
    } catch {
      setRateError("שגיאת תקשורת. אנא נסה שוב.");
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
        setRateSuccess("שער החליפין נשמר בהצלחה!");
        setTimeout(() => setRateSuccess(""), 3000);
        // Refresh rates list
        fetchCurrencyRates();
        // Reset form
        setFromCurrency("USD");
        setToCurrency("ILS");
        setRate("");
      } else {
        setRateError(data.message || "שגיאה בשמירת שער חליפין");
      }
    } catch {
      setRateError("שגיאת תקשורת. אנא נסה שוב.");
    } finally {
      setRateSaving(false);
    }
  };

  // Delete currency rate
  const handleDeleteRate = async (rateId: string) => {
    if (!confirm("האם למחוק את שער חליפין זה?")) return;

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
        setRateSuccess("שער החליפין נמחק בהצלחה!");
        setTimeout(() => setRateSuccess(""), 3000);
        // Refresh rates list
        fetchCurrencyRates();
      } else {
        setRateError(data.message || "שגיאה במחיקת שער חליפין");
      }
    } catch {
      setRateError("שגיאת תקשורת. אנא נסה שוב.");
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

  // Handle JSON backup export
  const handleExportBackup = async () => {
    setBackupLoading(true);
    setBackupError("");
    setBackupSuccess("");

    try {
      const response = await fetch("/api/backup/export");

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "שגיאה ביצירת הגיבוי");
      }

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = response.headers
        .get("Content-Disposition")
        ?.split('filename="')[1]
        .replace(/"/g, "") || `clockbill-backup-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setBackupSuccess("הגיבוי נוצר בהצלחה!");
      setTimeout(() => setBackupSuccess(""), 3000);
    } catch (error) {
      console.error("Error exporting backup:", error);
      setBackupError(error instanceof Error ? error.message : "שגיאה ביצירת הגיבוי");
    } finally {
      setBackupLoading(false);
    }
  };

  // Handle JSON backup file selection
  const handleBackupFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith(".json")) {
        setBackupError("יש לבחור קובץ JSON");
        return;
      }
      setBackupFile(file);
      setBackupError("");
      setBackupSuccess("");
      setBackupImportResults(null);
    }
  };

  // Handle JSON backup import
  const handleImportBackup = async () => {
    if (!backupFile) {
      setBackupError("יש לבחור קובץ גיבוי");
      return;
    }

    setBackupLoading(true);
    setBackupError("");
    setBackupSuccess("");
    setBackupImportResults(null);

    try {
      // Read and parse the backup file
      const text = await backupFile.text();
      const backup = JSON.parse(text);

      // Show confirmation dialog
      if (!showImportConfirm) {
        setShowImportConfirm(true);
        setBackupLoading(false);
        return;
      }

      // Import the backup
      const response = await fetch("/api/backup/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backup, mode: importMode }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "שגיאה בייבוא הגיבוי");
      }

      setBackupImportResults(data.stats);
      setBackupSuccess(`הגיבוי יובא בהצלחה!`);
      setShowImportConfirm(false);
      setBackupFile(null);

      // Reset file input
      if (backupInputRef.current) {
        backupInputRef.current.value = "";
      }

      setTimeout(() => setBackupSuccess(""), 5000);
    } catch (error) {
      console.error("Error importing backup:", error);
      setBackupError(error instanceof Error ? error.message : "שגיאה בייבוא הגיבוי");
      setShowImportConfirm(false);
    } finally {
      setBackupLoading(false);
    }
  };

  return (
    <AppLayout>
      <PageContainer>
        <PageHeader title="הגדרות" />

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
              פרופיל
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
              התראות
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
              מטבעות
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
              אבטחה
            </button>
            <button
              onClick={() => setActiveTab("import")}
              className={`px-4 py-2 text-sm font-medium rounded-full transition-colors ${
                activeTab === "import"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted"
              }`}
              role="tab"
              aria-selected={activeTab === "import"}
            >
              ייבוא נתונים
            </button>
          </nav>
        </div>

        {/* Currencies Tab Content */}
        {activeTab === "currencies" && (
          <div className="space-y-8" role="tabpanel">
            {/* Add Currency Rate Form */}
            <div className="bg-card rounded-[var(--radius-card)] border border-border/50 p-6 shadow-sm">
              <h2 className="font-display text-lg font-bold text-foreground mb-2">
                הוסף שער חליפין
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                הגדר שערי חליפין בין מטבעות שונים. שערים אלו ישמשו להמרת מטבעות בדוחות.
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
                      ממטבע
                    </label>
                    <select
                      id="fromCurrency"
                      value={fromCurrency}
                      onChange={(e) => setFromCurrency(e.target.value)}
                      className="w-full px-3 py-2.5 border border-border rounded-[var(--radius-card)] focus:ring-2 focus:ring-primary focus:border-primary"
                      disabled={rateSaving}
                    >
                      <option value="ILS">₪ - שקל ישראלי</option>
                      <option value="USD">$ - דולר אמריקאי</option>
                      <option value="USDT">₮ - טתר (USDT)</option>
                      <option value="BTC">₿ - ביטקוין</option>
                      <option value="ETH">Ξ - אתריום</option>
                    </select>
                  </div>

                  {/* To Currency */}
                  <div>
                    <label
                      htmlFor="toCurrency"
                      className="block text-sm font-medium text-muted-foreground mb-1"
                    >
                      למטבע
                    </label>
                    <select
                      id="toCurrency"
                      value={toCurrency}
                      onChange={(e) => setToCurrency(e.target.value)}
                      className="w-full px-3 py-2.5 border border-border rounded-[var(--radius-card)] focus:ring-2 focus:ring-primary focus:border-primary"
                      disabled={rateSaving}
                    >
                      <option value="ILS">₪ - שקל ישראלי</option>
                      <option value="USD">$ - דולר אמריקאי</option>
                      <option value="USDT">₮ - טתר (USDT)</option>
                      <option value="BTC">₿ - ביטקוין</option>
                      <option value="ETH">Ξ - אתריום</option>
                    </select>
                  </div>

                  {/* Rate */}
                  <div>
                    <label
                      htmlFor="rate"
                      className="block text-sm font-medium text-muted-foreground mb-1"
                    >
                      שער חליפין
                    </label>
                    <input
                      type="number"
                      id="rate"
                      value={rate}
                      onChange={(e) => setRate(e.target.value)}
                      placeholder="לדוגמה: 3.5"
                      step="0.00000001"
                      min="0"
                      required
                      className="w-full px-3 py-2.5 border border-border rounded-[var(--radius-card)] focus:ring-2 focus:ring-primary focus:border-primary"
                      disabled={rateSaving}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      כמה {getCurrencySymbol(toCurrency)} מקבלים עבור 1 {getCurrencySymbol(fromCurrency)}
                    </p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={rateSaving || fromCurrency === toCurrency}
                    className="px-6 py-2 bg-primary text-primary-foreground font-medium rounded-[var(--radius-card)] hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {rateSaving ? "שומר..." : "שמור שער"}
                  </button>
                </div>
              </form>
            </div>

            {/* Existing Rates List */}
            <div className="bg-card rounded-[var(--radius-card)] border border-border/50 p-6 shadow-sm">
              <h2 className="font-display text-lg font-bold text-foreground mb-4">
                שערי חליפין שהוגדרו
              </h2>

              {loading ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div>
                  <p className="mt-2 text-muted-foreground">טוען שערים...</p>
                </div>
              ) : currencyRates.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  לא הוגדרו שערי חליפין עדיין
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
                        מחק
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
          <div className="space-y-8" role="tabpanel">
            {/* Notification Permission */}
            <div className="bg-card rounded-[var(--radius-card)] border border-border/50 p-6 shadow-sm">
              <h2 className="font-display text-lg font-bold text-foreground mb-2">
                הרשאת התראות דפדפן
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                כדי שהמערכת תוכל לשלוח לך התראות, עליך לאפשר התראות מהדפדפן.
              </p>

              <div className="flex items-center justify-between p-4 rounded-[var(--radius-card)] border border-border bg-muted">
                <div>
                  <p className="font-medium text-foreground">סטטוס הרשאה</p>
                  <p className="text-sm text-muted-foreground">
                    {notificationPermission === "granted" && "✅ ההתראות מאופשרות"}
                    {notificationPermission === "denied" && "❌ ההתראות נחסמו"}
                    {notificationPermission === "default" && "⏳ טרם ניתנה הרשאה"}
                    {notificationPermission === null && "❌ הדפדפן לא תומך בהתראות"}
                  </p>
                </div>
                <div className="flex gap-3">
                  {notificationPermission !== "granted" && notificationPermission !== null && (
                    <button
                      onClick={requestNotificationPermission}
                      className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-[var(--radius-card)] hover:bg-primary/90 transition-colors"
                    >
                      אפשר התראות
                    </button>
                  )}
                  <button
                    onClick={handleTestNotification}
                    disabled={testingNotification || notificationPermission !== "granted"}
                    className="px-4 py-2 bg-foreground/70 text-white text-sm font-medium rounded-[var(--radius-card)] hover:bg-foreground/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {testingNotification ? "שולח..." : "נסה התראה"}
                  </button>
                </div>
              </div>
            </div>

            {/* Long Timer Notification */}
            <div className="bg-card rounded-[var(--radius-card)] border border-border/50 p-6 shadow-sm">
              <h2 className="font-display text-lg font-bold text-foreground mb-2">
                התראת טיימר ארוך
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                קבל התראה כאשר הטיימר רץ לפרק זמן ארוך (למשל, יותר מ-2 שעות).
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
                    <label className="text-sm font-medium text-muted-foreground">אפשר התראת טיימר ארוך</label>
                    <p className="text-xs text-muted-foreground mt-1">קבל התראה כאשר הטיימר רץ זמן רב מדי</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={longTimerEnabled}
                      onChange={(e) => setLongTimerEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                {/* Threshold */}
                {longTimerEnabled && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground block mb-2">
                      סף זמן מינימלי (בדקות)
                    </label>
                    <input
                      type="number"
                      value={longTimerThreshold}
                      onChange={(e) => setLongTimerThreshold(e.target.value)}
                      min="30"
                      max="480"
                      step="30"
                      className="w-full px-3 py-2.5 border border-border rounded-[var(--radius-card)] focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      התראה תישלח כאשר הטיימר רץ יותר מ-{parseInt(longTimerThreshold, 10)} דקות ({(parseInt(longTimerThreshold, 10) / 60).toFixed(1)} שעות)
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Daily Reminder */}
            <div className="bg-card rounded-[var(--radius-card)] border border-border/50 p-6 shadow-sm">
              <h2 className="font-display text-lg font-bold text-foreground mb-2">
                תזכורת יומית
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                קבל תזכורת יומית להזנת רשומות זמן אם טרם עשית זאת.
              </p>

              <div className="space-y-6">
                {/* Enable/Disable */}
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">אפשר תזכורת יומית</label>
                    <p className="text-xs text-muted-foreground mt-1">קבל תזכורת להזנת רשומות זמן</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dailyReminderEnabled}
                      onChange={(e) => setDailyReminderEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                {/* Time */}
                {dailyReminderEnabled && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground block mb-2">
                      שעת התזכורת
                    </label>
                    <input
                      type="time"
                      value={dailyReminderTime}
                      onChange={(e) => setDailyReminderTime(e.target.value)}
                      className="w-full px-3 py-2.5 border border-border rounded-[var(--radius-card)] focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      התזכורת תישלח ב-{dailyReminderTime} בכל יום שבו לא נרשמו שעות
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Working Hours */}
            <div className="bg-card rounded-[var(--radius-card)] border border-border/50 p-6 shadow-sm">
              <h2 className="font-display text-lg font-bold text-foreground mb-2">
                שעות עבודה יומיות
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                הגדר את מספר השעות היומיות שאתה עובד. זה שימושי למעקב ודוחות.
              </p>

              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-2">
                  שעות עבודה ליום
                </label>
                <input
                  type="number"
                  value={workingHours}
                  onChange={(e) => setWorkingHours(e.target.value)}
                  min="1"
                  max="24"
                  step="0.5"
                  className="w-full px-3 py-2.5 border border-border rounded-[var(--radius-card)] focus:ring-2 focus:ring-primary focus:border-primary"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  מספר השעות המלאות ליום עבודה: {workingHours} שעות
                </p>
              </div>
            </div>

            {/* First Day of Week */}
            <div className="bg-card rounded-[var(--radius-card)] border border-border/50 p-6 shadow-sm">
              <h2 className="font-display text-lg font-bold text-foreground mb-2">
                יום תחילת השבוע
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                בחר את היום שבו מתחיל השבוע שלך (משפיע על לוחות שנה ודוחות).
              </p>

              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-2">
                  יום תחילת שבוע
                </label>
                <select
                  value={firstDayOfWeek}
                  onChange={(e) => setFirstDayOfWeek(e.target.value)}
                  className="w-full px-3 py-2.5 border border-border rounded-[var(--radius-card)] focus:ring-2 focus:ring-primary focus:border-primary"
                >
                  <option value="sunday">ראשון (Sunday)</option>
                  <option value="monday">שני (Monday)</option>
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  {firstDayOfWeek === "sunday" ? "השבוע מתחיל ביום ראשון" : "השבוע מתחיל ביום שני"}
                </p>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
              <button
                onClick={handleSaveNotificationSettings}
                disabled={profileLoading}
                className="px-6 py-2 bg-primary text-primary-foreground font-medium rounded-[var(--radius-card)] hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {profileLoading ? (
                  <span className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    שומר...
                  </span>
                ) : (
                  "שמור הגדרות התראות"
                )}
              </button>
            </div>
          </div>
        )}

        {/* Security Tab Content */}
        {activeTab === "security" && (
          <div className="space-y-8" role="tabpanel">
            {/* Active Sessions Section */}
            <div className="bg-card rounded-[var(--radius-card)] border border-border/50 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-display text-lg font-bold text-foreground">
                  פעולות פעילות
                </h2>
                {sessions.length > 1 && (
                  <button
                    onClick={() => setShowConfirmDialog(true)}
                    disabled={logoutAllLoading}
                    className="px-4 py-2 bg-destructive text-white text-sm font-medium rounded-[var(--radius-card)] hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {logoutAllLoading ? "מתנתק..." : "התנתק מכל המכשירים"}
                  </button>
                )}
              </div>
              <p className="text-sm text-muted-foreground mb-6">
                רשימת כל המכשירים שמחוברים כרגע לחשבון שלך.
              </p>

              {loading ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div>
                  <p className="mt-2 text-muted-foreground">טוען פעולות...</p>
                </div>
              ) : error ? (
                <div className="rounded-[var(--radius-card)] bg-destructive/10 p-4">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              ) : sessions.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  אין פעולות פעילות
                </p>
              ) : (
                <div className="space-y-4">
                  {sessions.map((session) => (
                    <div
                      key={session.id}
                      className={`flex items-center justify-between p-4 rounded-[var(--radius-card)] border ${
                        session.is_current
                          ? "border-accent/30 bg-accent/5"
                          : "border-border bg-muted"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
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
                              d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                            />
                          </svg>
                        </div>
                        <div>
                          <p className="font-medium text-foreground flex items-center gap-2">
                            {getDeviceInfo(session.id)}
                            {session.is_current && (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-accent/10 text-accent">
                                <span className="w-2 h-2 rounded-full bg-accent"></span>
                                נוכחי
                              </span>
                            )}
                          </p>
                          <p className="font-mono text-sm text-muted-foreground">
                            התחברות: {formatDate(session.created_at)}
                          </p>
                          <p className="font-mono text-sm text-muted-foreground">
                            תפוגה: {formatDate(session.expires_at)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notifications Tab Content */}
        {activeTab === "notifications" && (
          <div className="space-y-8" role="tabpanel">
            {/* Permission Status */}
            <div className="bg-card rounded-[var(--radius-card)] border border-border/50 p-6 shadow-sm">
              <h2 className="font-display text-lg font-bold text-foreground mb-2">
                מצב הרשאות התראות
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                כדי לקבל התראות מהדפדפן, עליך לאפשר הרשאות התראות.
              </p>

              <div className="flex items-center justify-between p-4 rounded-[var(--radius-card)] border border-border bg-muted">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${
                    notificationPermission === "granted"
                      ? "bg-success/100"
                      : notificationPermission === "denied"
                      ? "bg-destructive/100"
                      : "bg-accent0"
                  }`}></div>
                  <div>
                    <p className="font-medium text-foreground">
                      {notificationPermission === "granted"
                        ? "ההרשאות מאופשרות"
                        : notificationPermission === "denied"
                        ? "ההרשאות נדחו"
                        : notificationPermission === "default"
                        ? "ההרשאות לא נקבעו עדיין"
                        : "התראות לא נתמכות"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {notificationPermission === "granted"
                        ? "המערכת יכולה לשלוח התראות"
                        : notificationPermission === "denied"
                        ? "יש לאפשר התראות בהגדרות הדפדפן"
                        : notificationPermission === "default"
                        ? "לחץ על הכפתור למטה כדי לאפשר התראות"
                        : "הדפדפן שלך לא תומך בהתראות"}
                    </p>
                  </div>
                </div>
                {notificationPermission === "default" && (
                  <button
                    onClick={requestNotificationPermission}
                    className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-[var(--radius-card)] hover:bg-primary/90 transition-colors"
                  >
                    אפשר התראות
                  </button>
                )}
              </div>
            </div>

            {/* Test Notification */}
            <div className="bg-card rounded-[var(--radius-card)] border border-border/50 p-6 shadow-sm">
              <h2 className="font-display text-lg font-bold text-foreground mb-2">
                בדיקת התראות
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                בדוק אם ההתראות עובדות כראוי על ידי שליחת התראת בדיקה.
              </p>

              <button
                onClick={handleTestNotification}
                disabled={testingNotification || notificationPermission !== "granted"}
                className="flex items-center gap-2 px-4 py-2 bg-secondary text-white text-sm font-medium rounded-[var(--radius-card)] hover:bg-secondary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {testingNotification ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    שולח...
                  </>
                ) : (
                  <>
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                      />
                    </svg>
                    שלח התראת בדיקה
                  </>
                )}
              </button>
            </div>

            {/* Notification Settings */}
            <div className="bg-card rounded-[var(--radius-card)] border border-border/50 p-6 shadow-sm">
              <h2 className="font-display text-lg font-bold text-foreground mb-2">
                הגדרות התראות
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                הגדר מתי לקבל התראות אוטומטיות.
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

              <form onSubmit={handleSaveNotificationSettings} className="space-y-6">
                {/* Long Timer Notification */}
                <div className="flex items-center justify-between p-4 rounded-[var(--radius-card)] border border-border">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <svg
                        className="w-6 h-6 text-primary"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <div>
                        <p className="font-medium text-foreground">
                          התראת טיימר ארוך
                        </p>
                        <p className="text-sm text-muted-foreground">
                          קבל התראה כשהטיימר רץ זמן רב מדי
                        </p>
                      </div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={longTimerEnabled}
                      onChange={(e) => setLongTimerEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-card after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                {longTimerEnabled && (
                  <div className="mr-9 p-4 rounded-[var(--radius-card)] border border-border bg-muted">
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      סף זמן (דקות)
                    </label>
                    <input
                      type="number"
                      value={longTimerThreshold}
                      onChange={(e) => setLongTimerThreshold(e.target.value)}
                      min="30"
                      max="480"
                      step="10"
                      className="w-full px-3 py-2.5 border border-border rounded-[var(--radius-card)] focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      שלח התראה לאחר הזמן הזה (מינימום: 30 דקות, מקסימום: 480 דקות)
                    </p>
                  </div>
                )}

                {/* Daily Reminder Notification */}
                <div className="flex items-center justify-between p-4 rounded-[var(--radius-card)] border border-border">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <svg
                        className="w-6 h-6 text-success"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                        />
                      </svg>
                      <div>
                        <p className="font-medium text-foreground">
                          תזכורת יומית
                        </p>
                        <p className="text-sm text-muted-foreground">
                          קבל תזכורת יומית לרשום זמן
                        </p>
                      </div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dailyReminderEnabled}
                      onChange={(e) => setDailyReminderEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-card after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                {dailyReminderEnabled && (
                  <div className="mr-9 p-4 rounded-[var(--radius-card)] border border-border bg-muted">
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      שעת התזכורת
                    </label>
                    <input
                      type="time"
                      value={dailyReminderTime}
                      onChange={(e) => setDailyReminderTime(e.target.value)}
                      className="w-full px-3 py-2.5 border border-border rounded-[var(--radius-card)] focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      התזכורת תישלח בשעה זו בכל יום
                    </p>
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={profileLoading}
                    className="px-6 py-2 bg-primary text-primary-foreground font-medium rounded-[var(--radius-card)] hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {profileLoading ? (
                      <span className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        שומר...
                      </span>
                    ) : (
                      "שמור הגדרות"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Profile Tab Content */}
        {activeTab === "profile" && (
          <div className="space-y-8" role="tabpanel">
            {/* Logo Upload Section */}
            <div className="bg-card rounded-[var(--radius-card)] border border-border/50 p-6 shadow-sm">
              <h2 className="font-display text-lg font-bold text-foreground mb-2">
                לוגו עסקי
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                הלוגו יופיע בדוחות PDF שתייצרו. מומלץ להשתמש בתמונה ריבועית בגודל 200x200 פיקסלים לפחות.
              </p>

              {logoError && (
                <div className="rounded-[var(--radius-card)] bg-destructive/10 p-4 mb-4">
                  <p className="text-sm text-destructive">{logoError}</p>
                </div>
              )}

              <div className="flex items-center gap-6">
                {/* Logo Preview */}
                <div className="w-32 h-32 rounded-full border-2 border-dashed border-border hover:border-primary/50 transition-colors flex items-center justify-center bg-muted overflow-hidden">
                  {profile?.logoUrl ? (
                    <img
                      src={profile.logoUrl}
                      alt="לוגו עסקי"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="text-center">
                      <svg
                        className="w-10 h-10 text-muted-foreground mx-auto mb-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      <span className="text-xs text-muted-foreground">אין לוגו</span>
                    </div>
                  )}
                </div>

                {/* Upload Actions */}
                <div className="space-y-3">
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
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-[var(--radius-card)] hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {logoLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        מעלה...
                      </>
                    ) : (
                      <>
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                          />
                        </svg>
                        {profile?.logoUrl ? "החלף לוגו" : "העלה לוגו"}
                      </>
                    )}
                  </button>

                  {profile?.logoUrl && (
                    <button
                      onClick={handleRemoveLogo}
                      disabled={logoLoading}
                      className="flex items-center gap-2 px-4 py-2 text-destructive text-sm font-medium rounded-[var(--radius-card)] hover:bg-destructive/10 disabled:opacity-50 transition-colors"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                      הסר לוגו
                    </button>
                  )}
                </div>
              </div>

              <p className="text-xs text-muted-foreground mt-4">
                פורמטים נתמכים: JPEG, PNG, GIF, WebP. גודל מקסימלי: 5MB.
              </p>
            </div>

            {/* Signature Upload Section */}
            <div className="bg-card rounded-[var(--radius-card)] border border-border/50 p-6 shadow-sm">
              <h2 className="font-display text-lg font-bold text-foreground mb-2">
                חתימה דיגיטלית
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                החתימה תופיע בחשבוניות PDF. מומלץ להשתמש בתמונה עם רקע שקוף (PNG) בגודל 200x80 פיקסלים לפחות.
              </p>

              {signatureError && (
                <div className="rounded-[var(--radius-card)] bg-destructive/10 p-4 mb-4">
                  <p className="text-sm text-destructive">{signatureError}</p>
                </div>
              )}

              <div className="flex items-center gap-6">
                {/* Signature Preview */}
                <div className="w-64 h-32 rounded-[var(--radius-card)] border-2 border-dashed border-border hover:border-primary/50 transition-colors flex items-center justify-center bg-muted overflow-hidden">
                  {profile?.signatureUrl ? (
                    <img
                      src={profile.signatureUrl}
                      alt="חתימה דיגיטלית"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="text-center">
                      <svg
                        className="w-10 h-10 text-muted-foreground mx-auto mb-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                        />
                      </svg>
                      <span className="text-xs text-muted-foreground">אין חתימה</span>
                    </div>
                  )}
                </div>

                {/* Upload Actions */}
                <div className="space-y-3">
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
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-[var(--radius-card)] hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {signatureLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        מעלה...
                      </>
                    ) : (
                      <>
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                          />
                        </svg>
                        {profile?.signatureUrl ? "החלף חתימה" : "העלה חתימה"}
                      </>
                    )}
                  </button>

                  {profile?.signatureUrl && (
                    <button
                      onClick={handleRemoveSignature}
                      disabled={signatureLoading}
                      className="flex items-center gap-2 px-4 py-2 text-destructive text-sm font-medium rounded-[var(--radius-card)] hover:bg-destructive/10 disabled:opacity-50 transition-colors"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                      הסר חתימה
                    </button>
                  )}
                </div>
              </div>

              <p className="text-xs text-muted-foreground mt-4">
                פורמטים נתמכים: JPEG, PNG, GIF, WebP. גודל מקסימלי: 2MB. מומלץ להשתמש ב-PNG עם רקע שקוף.
              </p>
            </div>

            {/* Business Details Form */}
            <div className="bg-card rounded-[var(--radius-card)] border border-border/50 p-6 shadow-sm">
              <h2 className="font-display text-lg font-bold text-foreground mb-2">
                פרטי עסק
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                פרטים אלו יופיעו בדוחות ובחשבוניות שתייצרו.
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
                  <p className="mt-2 text-muted-foreground">טוען פרטים...</p>
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
                        שם העסק
                      </label>
                      <input
                        type="text"
                        id="businessName"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder="לדוגמה: חברת הייעוץ שלי"
                        className="w-full px-3 py-2.5 border border-border rounded-[var(--radius-card)] focus:ring-2 focus:ring-primary focus:border-primary"
                      />
                    </div>

                    {/* Phone */}
                    <div>
                      <label
                        htmlFor="phone"
                        className="block text-sm font-medium text-muted-foreground mb-1"
                      >
                        טלפון
                      </label>
                      <input
                        type="tel"
                        id="phone"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="לדוגמה: 050-1234567"
                        className="w-full px-3 py-2.5 border border-border rounded-[var(--radius-card)] focus:ring-2 focus:ring-primary focus:border-primary"
                      />
                    </div>

                    {/* Email */}
                    <div>
                      <label
                        htmlFor="email"
                        className="block text-sm font-medium text-muted-foreground mb-1"
                      >
                        אימייל עסקי
                      </label>
                      <input
                        type="email"
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="לדוגמה: info@example.com"
                        className="w-full px-3 py-2.5 border border-border rounded-[var(--radius-card)] focus:ring-2 focus:ring-primary focus:border-primary"
                      />
                    </div>

                    {/* Tax ID */}
                    <div>
                      <label
                        htmlFor="taxId"
                        className="block text-sm font-medium text-muted-foreground mb-1"
                      >
                        ח.פ. / מספר עוסק
                      </label>
                      <input
                        type="text"
                        id="taxId"
                        value={taxId}
                        onChange={(e) => setTaxId(e.target.value)}
                        placeholder="לדוגמה: 123456789"
                        className="w-full px-3 py-2.5 border border-border rounded-[var(--radius-card)] focus:ring-2 focus:ring-primary focus:border-primary"
                      />
                    </div>

                    {/* Website */}
                    <div>
                      <label
                        htmlFor="website"
                        className="block text-sm font-medium text-muted-foreground mb-1"
                      >
                        אתר אינטרנט
                      </label>
                      <input
                        type="url"
                        id="website"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        placeholder="לדוגמה: https://example.com"
                        className="w-full px-3 py-2.5 border border-border rounded-[var(--radius-card)] focus:ring-2 focus:ring-primary focus:border-primary"
                      />
                    </div>

                    {/* Address */}
                    <div className="md:col-span-2">
                      <label
                        htmlFor="address"
                        className="block text-sm font-medium text-muted-foreground mb-1"
                      >
                        כתובת
                      </label>
                      <textarea
                        id="address"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="לדוגמה: רחוב הרצל 1, תל אביב"
                        rows={3}
                        className="w-full px-3 py-2 border border-border rounded-[var(--radius-card)] focus:ring-2 focus:ring-primary focus:border-primary resize-none"
                      />
                    </div>

                    {/* Default Currency */}
                    <div>
                      <label
                        htmlFor="defaultCurrency"
                        className="block text-sm font-medium text-muted-foreground mb-1"
                      >
                        מטבע ברירת מחדל
                      </label>
                      <select
                        id="defaultCurrency"
                        value={defaultCurrency}
                        onChange={(e) => setDefaultCurrency(e.target.value)}
                        className="w-full px-3 py-2.5 border border-border rounded-[var(--radius-card)] focus:ring-2 focus:ring-primary focus:border-primary"
                      >
                        <option value="ILS">₪ - שקל ישראלי</option>
                        <option value="USD">$ - דולר אמריקאי</option>
                        <option value="USDT">₮ - טתר (USDT)</option>
                        <option value="BTC">₿ - ביטקוין</option>
                        <option value="ETH">Ξ - אתריום</option>
                      </select>
                      <p className="text-xs text-muted-foreground mt-1">
                        המטבע שיופיע כברירת מחדל בפרויקטים חדשים
                      </p>
                    </div>

                    {/* Preferred PDF Template */}
                    <div>
                      <label
                        htmlFor="preferredPdfTemplate"
                        className="block text-sm font-medium text-muted-foreground mb-1"
                      >
                        תבנית PDF ברירת מחדל
                      </label>
                      <select
                        id="preferredPdfTemplate"
                        value={preferredPdfTemplate}
                        onChange={(e) => setPreferredPdfTemplate(e.target.value)}
                        className="w-full px-3 py-2.5 border border-border rounded-[var(--radius-card)] focus:ring-2 focus:ring-primary focus:border-primary"
                      >
                        <option value="modern">מודרני (Modern)</option>
                        <option value="classic">קלאסי (Classic)</option>
                        <option value="bold">בולד (Bold)</option>
                        <option value="elegant">אלגנטי (Elegant)</option>
                        <option value="nature">טבע (Nature)</option>
                        <option value="ocean">אוקיינוס (Ocean)</option>
                      </select>
                      <p className="text-xs text-muted-foreground mt-1">
                        התבנית שתשמש כברירת מחדל בייצוא דוחות PDF
                      </p>
                    </div>

                    {/* PDF Primary Color */}
                    <div>
                      <label
                        htmlFor="pdfPrimaryColor"
                        className="block text-sm font-medium text-muted-foreground mb-1"
                      >
                        צבע ראשי ל-PDF
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          id="pdfPrimaryColor"
                          value={pdfPrimaryColor}
                          onChange={(e) => setPdfPrimaryColor(e.target.value)}
                          className="h-10 w-20 border border-border rounded-[var(--radius-card)] cursor-pointer"
                        />
                        <input
                          type="text"
                          value={pdfPrimaryColor}
                          onChange={(e) => setPdfPrimaryColor(e.target.value)}
                          placeholder="#A8622D"
                          className="flex-1 px-3 py-2 border border-border rounded-[var(--radius-card)] focus:ring-2 focus:ring-primary focus:border-primary font-mono text-sm"
                          pattern="^#[0-9A-Fa-f]{6}$"
                          maxLength={7}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        הצבע הראשי שיופיע בכותרות ואלמנטים מרכזיים ב-PDF
                      </p>
                    </div>

                    {/* PDF Accent Color */}
                    <div>
                      <label
                        htmlFor="pdfAccentColor"
                        className="block text-sm font-medium text-muted-foreground mb-1"
                      >
                        צבע משני ל-PDF
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          id="pdfAccentColor"
                          value={pdfAccentColor}
                          onChange={(e) => setPdfAccentColor(e.target.value)}
                          className="h-10 w-20 border border-border rounded-[var(--radius-card)] cursor-pointer"
                        />
                        <input
                          type="text"
                          value={pdfAccentColor}
                          onChange={(e) => setPdfAccentColor(e.target.value)}
                          placeholder="#347B52"
                          className="flex-1 px-3 py-2 border border-border rounded-[var(--radius-card)] focus:ring-2 focus:ring-primary focus:border-primary font-mono text-sm"
                          pattern="^#[0-9A-Fa-f]{6}$"
                          maxLength={7}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        הצבע המשני שיופיע בפרטים ואלמנטים נוספים ב-PDF
                      </p>
                    </div>

                    {/* Date Format */}
                    <div>
                      <label
                        htmlFor="dateFormat"
                        className="block text-sm font-medium text-muted-foreground mb-1"
                      >
                        פורמט תאריך
                      </label>
                      <select
                        id="dateFormat"
                        value={dateFormat}
                        onChange={(e) => setDateFormat(e.target.value)}
                        className="w-full px-3 py-2.5 border border-border rounded-[var(--radius-card)] focus:ring-2 focus:ring-primary focus:border-primary"
                      >
                        <option value="DD/MM/YYYY">יום/חודש/שנה (DD/MM/YYYY)</option>
                        <option value="MM/DD/YYYY">חודש/יום/שנה (MM/DD/YYYY)</option>
                        <option value="YYYY-MM-DD">שנה-חודש-יום (YYYY-MM-DD)</option>
                      </select>
                      <p className="text-xs text-muted-foreground mt-1">
                        פורמט התצוגה של תאריכים במערכת
                      </p>
                    </div>

                    {/* Time Format */}
                    <div>
                      <label
                        htmlFor="timeFormat"
                        className="block text-sm font-medium text-muted-foreground mb-1"
                      >
                        פורמט שעה
                      </label>
                      <select
                        id="timeFormat"
                        value={timeFormat}
                        onChange={(e) => setTimeFormat(e.target.value)}
                        className="w-full px-3 py-2.5 border border-border rounded-[var(--radius-card)] focus:ring-2 focus:ring-primary focus:border-primary"
                      >
                        <option value="24h">24 שעות (14:30)</option>
                        <option value="12h">12 שעות (02:30 PM)</option>
                      </select>
                      <p className="text-xs text-muted-foreground mt-1">
                        פורמט התצוגה של שעות במערכת
                      </p>
                    </div>

                    {/* Invoice Prefix */}
                    <div>
                      <label
                        htmlFor="invoicePrefix"
                        className="block text-sm font-medium text-muted-foreground mb-1"
                      >
                        קידומת חשבונית
                      </label>
                      <input
                        type="text"
                        id="invoicePrefix"
                        value={invoicePrefix}
                        onChange={(e) => setInvoicePrefix(e.target.value)}
                        placeholder="לדוגמה: INV-"
                        className="w-full px-3 py-2.5 border border-border rounded-[var(--radius-card)] focus:ring-2 focus:ring-primary focus:border-primary"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        הקידומת תופיע לפני מספר החשבונית (לדוגמה: INV-001, INV-002)
                      </p>
                    </div>

                    {/* Next Invoice Number */}
                    <div>
                      <label
                        htmlFor="nextInvoiceNumber"
                        className="block text-sm font-medium text-muted-foreground mb-1"
                      >
                        מספר החשבונית הבא
                      </label>
                      <input
                        type="number"
                        id="nextInvoiceNumber"
                        value={nextInvoiceNumber}
                        onChange={(e) => setNextInvoiceNumber(e.target.value)}
                        placeholder="לדוגמה: 1"
                        min="1"
                        className="w-full px-3 py-2.5 border border-border rounded-[var(--radius-card)] focus:ring-2 focus:ring-primary focus:border-primary"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        מספר החשבונית הבא שיונפק. המספר יעלה אוטומטית לאחר כל חשבונית
                      </p>
                    </div>

                    {/* Payment Terms */}
                    <div className="md:col-span-2">
                      <label
                        htmlFor="paymentTerms"
                        className="block text-sm font-medium text-muted-foreground mb-1"
                      >
                        תנאי תשלום
                      </label>
                      <textarea
                        id="paymentTerms"
                        value={paymentTerms}
                        onChange={(e) => setPaymentTerms(e.target.value)}
                        placeholder="לדוגמה: תשלום בתוך 30 יום מתאריך החשבונית"
                        rows={3}
                        className="w-full px-3 py-2 border border-border rounded-[var(--radius-card)] focus:ring-2 focus:ring-primary focus:border-primary resize-none"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        תנאי התשלום יופיעו בחשבוניות ובדוחות
                      </p>
                    </div>
                  </div>

                  {/* Bank Details Section */}
                  <div className="border-t border-border pt-6 mt-6">
                    <h3 className="text-lg font-semibold text-foreground mb-4">פרטי בנק להעברות</h3>
                    <p className="text-sm text-muted-foreground mb-6">
                      פרטים אלו יופיעו בחשבוניות כדי לאפשר העברת תשלומים
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Bank Name */}
                      <div>
                        <label
                          htmlFor="bankName"
                          className="block text-sm font-medium text-muted-foreground mb-1"
                        >
                          שם הבנק
                        </label>
                        <input
                          type="text"
                          id="bankName"
                          value={bankName}
                          onChange={(e) => setBankName(e.target.value)}
                          placeholder="לדוגמה: בנק הפועלים"
                          className="w-full px-3 py-2.5 border border-border rounded-[var(--radius-card)] focus:ring-2 focus:ring-primary focus:border-primary"
                        />
                      </div>

                      {/* Bank Branch */}
                      <div>
                        <label
                          htmlFor="bankBranch"
                          className="block text-sm font-medium text-muted-foreground mb-1"
                        >
                          מספר סניף
                        </label>
                        <input
                          type="text"
                          id="bankBranch"
                          value={bankBranch}
                          onChange={(e) => setBankBranch(e.target.value)}
                          placeholder="לדוגמה: 123"
                          className="w-full px-3 py-2.5 border border-border rounded-[var(--radius-card)] focus:ring-2 focus:ring-primary focus:border-primary"
                        />
                      </div>

                      {/* Bank Account Number */}
                      <div>
                        <label
                          htmlFor="bankAccountNumber"
                          className="block text-sm font-medium text-muted-foreground mb-1"
                        >
                          מספר חשבון
                        </label>
                        <input
                          type="text"
                          id="bankAccountNumber"
                          value={bankAccountNumber}
                          onChange={(e) => setBankAccountNumber(e.target.value)}
                          placeholder="לדוגמה: 123456"
                          className="w-full px-3 py-2.5 border border-border rounded-[var(--radius-card)] focus:ring-2 focus:ring-primary focus:border-primary"
                        />
                      </div>

                      {/* Bank Swift / BIC */}
                      <div>
                        <label
                          htmlFor="bankSwift"
                          className="block text-sm font-medium text-muted-foreground mb-1"
                        >
                          מזהה בנק בינלאומי (SWIFT/BIC)
                        </label>
                        <input
                          type="text"
                          id="bankSwift"
                          value={bankSwift}
                          onChange={(e) => setBankSwift(e.target.value)}
                          placeholder="לדוגמה: POHALILIT"
                          className="w-full px-3 py-2.5 border border-border rounded-[var(--radius-card)] focus:ring-2 focus:ring-primary focus:border-primary"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          נדרש להעברות בינלאומיות בלבד
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={profileLoading}
                      className="px-6 py-2 bg-primary text-primary-foreground font-medium rounded-[var(--radius-card)] hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {profileLoading ? (
                        <span className="flex items-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                          שומר...
                        </span>
                      ) : (
                        "שמור שינויים"
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* Import Tab Content */}
        {activeTab === "import" && (
          <div role="tabpanel">
            <ImportContent
            importType={importType}
            setImportType={setImportType}
            importFile={importFile}
            setImportFile={setImportFile}
            importLoading={importLoading}
            setImportLoading={setImportLoading}
            importError={importError}
            setImportError={setImportError}
            importSuccess={importSuccess}
            setImportSuccess={setImportSuccess}
            importResults={importResults}
            setImportResults={setImportResults}
            csvHeaders={csvHeaders}
            setCsvHeaders={setCsvHeaders}
            csvPreview={csvPreview}
            setCsvPreview={setCsvPreview}
            columnMapping={columnMapping}
            setColumnMapping={setColumnMapping}
            showMappingStep={showMappingStep}
            setShowMappingStep={setShowMappingStep}
            importClientsRef={importClientsRef}
            importEntriesRef={importEntriesRef}
            backupFile={backupFile}
            setBackupFile={setBackupFile}
            backupLoading={backupLoading}
            setBackupLoading={setBackupLoading}
            backupError={backupError}
            setBackupError={setBackupError}
            backupSuccess={backupSuccess}
            setBackupSuccess={setBackupSuccess}
            backupImportResults={backupImportResults}
            setBackupImportResults={setBackupImportResults}
            importMode={importMode}
            setImportMode={setImportMode}
            showImportConfirm={showImportConfirm}
            setShowImportConfirm={setShowImportConfirm}
            backupInputRef={backupInputRef}
            handleExportBackup={handleExportBackup}
            handleImportBackup={handleImportBackup}
          />
          </div>
        )}
      </PageContainer>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card rounded-[var(--radius-card)] border border-border/50 shadow-xl p-6 max-w-md w-full mx-4 motion-safe:animate-scale-in" dir="rtl">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              האם אתה בטוח?
            </h3>
            <p className="text-muted-foreground mb-6">
              פעולה זו תנתק אותך מכל המכשירים המחוברים לחשבון שלך, כולל המכשיר הנוכחי. תצטרך להתחבר מחדש.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirmDialog(false)}
                disabled={logoutAllLoading}
                className="px-4 py-2 text-muted-foreground bg-muted rounded-[var(--radius-card)] hover:bg-muted disabled:opacity-50 transition-colors"
              >
                ביטול
              </button>
              <button
                onClick={handleLogoutAll}
                disabled={logoutAllLoading}
                className="px-4 py-2 bg-destructive text-white rounded-[var(--radius-card)] hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {logoutAllLoading ? "מתנתק..." : "התנתק מכל המכשירים"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Confirmation Dialog */}
      {showImportConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card rounded-[var(--radius-card)] border border-border/50 shadow-xl p-6 max-w-md w-full mx-4 motion-safe:animate-scale-in" dir="rtl">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              אישור שחזור גיבוי
            </h3>
            <div className="space-y-3 mb-6">
              <p className="text-muted-foreground">
                אתה עומד לשחזר נתונים מקובץ הגיבוי:
              </p>
              <p className="text-sm font-medium text-foreground">{backupFile?.name}</p>
              <div className={`p-3 rounded-[var(--radius-card)] ${
                importMode === "replace"
                  ? "bg-destructive/10 border border-destructive/20"
                  : "bg-secondary-light border border-secondary/20"
              }`}>
                <p className="text-sm font-medium mb-1">
                  {importMode === "replace" ? "⚠️ מצב החלפה" : "📥 מצב מיזוג"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {importMode === "replace"
                    ? "כל הנתונים הקיימים יימחקו לפני השחזור. פעולה זו אינה הפיכה!"
                    : "נתונים חדשים יתווספו. נתונים קיימים עם אותו שם לא יוחלפו."}
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowImportConfirm(false);
                  setBackupLoading(false);
                }}
                disabled={backupLoading}
                className="px-4 py-2 text-muted-foreground bg-muted rounded-[var(--radius-card)] hover:bg-muted disabled:opacity-50 transition-colors"
              >
                ביטול
              </button>
              <button
                onClick={() => handleImportBackup()}
                disabled={backupLoading}
                className={`px-4 py-2 text-white rounded-[var(--radius-card)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                  importMode === "replace"
                    ? "bg-destructive hover:bg-destructive/90"
                    : "bg-success hover:bg-success/90"
                }`}
              >
                {backupLoading ? "משחזר..." : "אשר שחזור"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
