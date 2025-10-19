export const metadata = {
  title: 'Hỗ trợ | Credit Checker',
}

export default function SupportPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Hỗ trợ</h1>
      <p className="text-muted-foreground mb-4">
        Trang này đang được cập nhật. Vui lòng liên hệ Telegram hoặc email hiển thị trong phần cấu hình hệ thống.
      </p>
      <ul className="list-disc pl-6 space-y-2">
        <li>Telegram: <a className="text-blue-600 underline" href="https://t.me/" target="_blank" rel="noreferrer">@support</a></li>
        <li>Email: support@example.com</li>
      </ul>
    </div>
  )
}
