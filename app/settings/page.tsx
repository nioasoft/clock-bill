"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
  phone: string | null;
  email: string | null;
  address: string | null;
  taxId: string | null;
  website: string | null;
  defaultCurrency: string;
  preferredPdfTemplate: string;
  createdAt: string;
  updatedAt: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"profile" | "security">("profile");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [logoLoading, setLogoLoading] = useState(false);
  const [error, setError] = useState("");
  const [profileError, setProfileError] = useState("");
  const [logoError, setLogoError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [logoutAllLoading, setLogoutAllLoading] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile form state
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [taxId, setTaxId] = useState("");
  const [website, setWebsite] = useState("");
  const [defaultCurrency, setDefaultCurrency] = useState("ILS");
  const [preferredPdfTemplate, setPreferredPdfTemplate] = useState("modern");

  useEffect(() => {
    if (activeTab === "security") {
      fetchSessions();
    } else if (activeTab === "profile") {
      fetchProfile();
    }
  }, [activeTab]);

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

  return (
    <div className="min-h-screen bg-zinc-50" dir="rtl">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-2xl font-bold text-gray-900 hover:text-orange-600"
            >
              שעון
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              חזרה לדשבורד
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">הגדרות</h1>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="flex gap-8">
            <button
              onClick={() => setActiveTab("profile")}
              className={`pb-4 px-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "profile"
                  ? "border-orange-500 text-orange-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              פרופיל
            </button>
            <button
              onClick={() => setActiveTab("security")}
              className={`pb-4 px-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "security"
                  ? "border-orange-500 text-orange-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              אבטחה
            </button>
          </nav>
        </div>

        {/* Security Tab Content */}
        {activeTab === "security" && (
          <div className="space-y-8">
            {/* Active Sessions Section */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  פעולות פעילות
                </h2>
                {sessions.length > 1 && (
                  <button
                    onClick={() => setShowConfirmDialog(true)}
                    disabled={logoutAllLoading}
                    className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {logoutAllLoading ? "מתנתק..." : "התנתק מכל המכשירים"}
                  </button>
                )}
              </div>
              <p className="text-sm text-gray-600 mb-6">
                רשימת כל המכשירים שמחוברים כרגע לחשבון שלך.
              </p>

              {loading ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-orange-500 border-t-transparent"></div>
                  <p className="mt-2 text-gray-600">טוען פעולות...</p>
                </div>
              ) : error ? (
                <div className="rounded-md bg-red-50 p-4">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              ) : sessions.length === 0 ? (
                <p className="text-gray-600 text-center py-8">
                  אין פעולות פעילות
                </p>
              ) : (
                <div className="space-y-4">
                  {sessions.map((session) => (
                    <div
                      key={session.id}
                      className={`flex items-center justify-between p-4 rounded-lg border ${
                        session.is_current
                          ? "border-orange-200 bg-orange-50"
                          : "border-gray-200 bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                          <svg
                            className="w-5 h-5 text-gray-600"
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
                          <p className="font-medium text-gray-900">
                            {getDeviceInfo(session.id)}
                            {session.is_current && (
                              <span className="mr-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                                נוכחי
                              </span>
                            )}
                          </p>
                          <p className="text-sm text-gray-600">
                            התחברות: {formatDate(session.created_at)}
                          </p>
                          <p className="text-sm text-gray-500">
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

        {/* Profile Tab Content */}
        {activeTab === "profile" && (
          <div className="space-y-8">
            {/* Logo Upload Section */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                לוגו עסקי
              </h2>
              <p className="text-sm text-gray-600 mb-6">
                הלוגו יופיע בדוחות PDF שתייצרו. מומלץ להשתמש בתמונה ריבועית בגודל 200x200 פיקסלים לפחות.
              </p>

              {logoError && (
                <div className="rounded-md bg-red-50 p-4 mb-4">
                  <p className="text-sm text-red-700">{logoError}</p>
                </div>
              )}

              <div className="flex items-center gap-6">
                {/* Logo Preview */}
                <div className="w-32 h-32 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50 overflow-hidden">
                  {profile?.logoUrl ? (
                    <img
                      src={profile.logoUrl}
                      alt="לוגו עסקי"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="text-center">
                      <svg
                        className="w-10 h-10 text-gray-400 mx-auto mb-2"
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
                      <span className="text-xs text-gray-500">אין לוגו</span>
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
                    className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                      className="flex items-center gap-2 px-4 py-2 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
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

              <p className="text-xs text-gray-500 mt-4">
                פורמטים נתמכים: JPEG, PNG, GIF, WebP. גודל מקסימלי: 5MB.
              </p>
            </div>

            {/* Business Details Form */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                פרטי עסק
              </h2>
              <p className="text-sm text-gray-600 mb-6">
                פרטים אלו יופיעו בדוחות ובחשבוניות שתייצרו.
              </p>

              {profileError && (
                <div className="rounded-md bg-red-50 p-4 mb-4">
                  <p className="text-sm text-red-700">{profileError}</p>
                </div>
              )}

              {successMessage && (
                <div className="rounded-md bg-green-50 p-4 mb-4">
                  <p className="text-sm text-green-700">{successMessage}</p>
                </div>
              )}

              {loading ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-orange-500 border-t-transparent"></div>
                  <p className="mt-2 text-gray-600">טוען פרטים...</p>
                </div>
              ) : (
                <form onSubmit={handleSaveProfile} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Business Name */}
                    <div>
                      <label
                        htmlFor="businessName"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        שם העסק
                      </label>
                      <input
                        type="text"
                        id="businessName"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder="לדוגמה: חברת הייעוץ שלי"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                    </div>

                    {/* Phone */}
                    <div>
                      <label
                        htmlFor="phone"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        טלפון
                      </label>
                      <input
                        type="tel"
                        id="phone"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="לדוגמה: 050-1234567"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                    </div>

                    {/* Email */}
                    <div>
                      <label
                        htmlFor="email"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        אימייל עסקי
                      </label>
                      <input
                        type="email"
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="לדוגמה: info@example.com"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                    </div>

                    {/* Tax ID */}
                    <div>
                      <label
                        htmlFor="taxId"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        ח.פ. / מספר עוסק
                      </label>
                      <input
                        type="text"
                        id="taxId"
                        value={taxId}
                        onChange={(e) => setTaxId(e.target.value)}
                        placeholder="לדוגמה: 123456789"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                    </div>

                    {/* Website */}
                    <div>
                      <label
                        htmlFor="website"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        אתר אינטרנט
                      </label>
                      <input
                        type="url"
                        id="website"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        placeholder="לדוגמה: https://example.com"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                    </div>

                    {/* Address */}
                    <div className="md:col-span-2">
                      <label
                        htmlFor="address"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        כתובת
                      </label>
                      <textarea
                        id="address"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="לדוגמה: רחוב הרצל 1, תל אביב"
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none"
                      />
                    </div>

                    {/* Default Currency */}
                    <div>
                      <label
                        htmlFor="defaultCurrency"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        מטבע ברירת מחדל
                      </label>
                      <select
                        id="defaultCurrency"
                        value={defaultCurrency}
                        onChange={(e) => setDefaultCurrency(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      >
                        <option value="ILS">₪ - שקל ישראלי</option>
                        <option value="USD">$ - דולר אמריקאי</option>
                        <option value="USDT">₮ - טתר (USDT)</option>
                        <option value="BTC">₿ - ביטקוין</option>
                        <option value="ETH">Ξ - אתריום</option>
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        המטבע שיופיע כברירת מחדל בפרויקטים חדשים
                      </p>
                    </div>

                    {/* Preferred PDF Template */}
                    <div>
                      <label
                        htmlFor="preferredPdfTemplate"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        תבנית PDF ברירת מחדל
                      </label>
                      <select
                        id="preferredPdfTemplate"
                        value={preferredPdfTemplate}
                        onChange={(e) => setPreferredPdfTemplate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      >
                        <option value="modern">מודרני (Modern)</option>
                        <option value="classic">קלאסי (Classic)</option>
                        <option value="bold">בולד (Bold)</option>
                        <option value="elegant">אלגנטי (Elegant)</option>
                        <option value="nature">טבע (Nature)</option>
                        <option value="ocean">אוקיינוס (Ocean)</option>
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        התבנית שתשמש כברירת מחדל בייצוא דוחות PDF
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={profileLoading}
                      className="px-6 py-2 bg-orange-600 text-white font-medium rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
      </main>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4" dir="rtl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              האם אתה בטוח?
            </h3>
            <p className="text-gray-600 mb-6">
              פעולה זו תנתק אותך מכל המכשירים המחוברים לחשבון שלך, כולל המכשיר הנוכחי. תצטרך להתחבר מחדש.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirmDialog(false)}
                disabled={logoutAllLoading}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
              >
                ביטול
              </button>
              <button
                onClick={handleLogoutAll}
                disabled={logoutAllLoading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {logoutAllLoading ? "מתנתק..." : "התנתק מכל המכשירים"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
