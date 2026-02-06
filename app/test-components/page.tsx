"use client"

import { useState } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export default function TestComponentsPage() {
  const [selectedCurrency, setSelectedCurrency] = useState("ILS")
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold text-gray-900">
          בדיקת רכיבי UI
        </h1>

        {/* Select Component Test */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            בדיקת רכיב Select
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            רכיב בחירה נגיש ומעוצב עם תמיכה ב-RTL
          </p>

          <div className="w-full max-w-xs">
            <label
              htmlFor="currency"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              בחר מטבע
            </label>
            <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
              <SelectTrigger id="currency">
                <SelectValue placeholder="בחר מטבע" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ILS">₪ - שקל ישראלי</SelectItem>
                <SelectItem value="USD">$ - דולר אמריקאי</SelectItem>
                <SelectItem value="USDT">₮ - טתר (USDT)</SelectItem>
                <SelectItem value="BTC">₿ - ביטקוין</SelectItem>
                <SelectItem value="ETH">Ξ - אתריום</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-gray-500 mt-2">
              נבחר: <strong>{selectedCurrency}</strong>
            </p>
          </div>
        </div>

        {/* Dialog Component Test */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            בדיקת רכיב Dialog
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            חלונית מודאלית נגישה עם אנימציות ותמיכה ב-RTL
          </p>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <button className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors">
                פתח דיאלוג
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>אישור פעולה</DialogTitle>
                <DialogDescription>
                  זוהי דוגמה לרכיב דיאלוג עם תמיכה מלאה בעברית ו-RTL.
                  הדיאלוג כולל אנימציות כניסה ויציאה וניתן לסגירה באמצעות לחיצה על כפתור ה-X או לחיצה מחוץ לדיאלוג.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <p className="text-sm text-gray-600">
                  תוכן הדיאלוג מופיע כאן. אפשר להוסיף כל רכיב שתרצו בתוך הדיאלוג.
                </p>
              </div>
              <DialogFooter>
                <button
                  onClick={() => setDialogOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  ביטול
                </button>
                <button
                  onClick={() => {
                    alert("אישרת!")
                    setDialogOpen(false)
                  }}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                >
                  אישור
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">
            מידע על הרכיבים
          </h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>✓ שני הרכיבים מבוססים על Radix UI - ספריית רכיבים נגישה מאוד</li>
            <li>✓ תמיכה מלאה בעברית ו-RTL</li>
            <li>✓ אנימציות חלקות לכניסה ויציאה</li>
            <li>✓ ניתן להתאים אישית עם className</li>
            <li>✓ תואמים את שפת העיצוב של האפליקציה</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
