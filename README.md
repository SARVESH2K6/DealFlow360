# DealFlow360

DealFlow360 is a comprehensive, internal B2B sales operations workspace designed for modern sales teams. It features a warm-neutral, premium UI, a role-gated internal application, and a separate portal for customers to view and negotiate quotations in real-time.

---

## 🚀 How to Run

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Start the development server**
   ```bash
   npm run dev
   ```
   This uses `concurrently` to run both the frontend and backend servers simultaneously.

3. **Access the application**
   - **Frontend App**: [http://localhost:5173](http://localhost:5173)
   - **Backend API**: [http://localhost:3001](http://localhost:3001)

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Routing**: React Router
- **Data Fetching**: React Query (@tanstack/react-query)
- **Icons**: Lucide React
- **Charts**: Recharts

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Real-time Communication**: Socket.IO
- **Database**: In-memory data store for development (`server/store.js`)
- **Authentication**: JSON Web Tokens (JWT)

---

## 👥 Roles & Demo Accounts

The application is role-gated with different permissions and views for internal employees and external customers. Use the password `password` for all demo accounts below:

| Role | Email | Description |
| --- | --- | --- |
| **Sales Rep** | `ivan.p@example.net` | Can create draft quotations, add products, and propose discounts. |
| **Sales Manager** | `olivia.t@example.org` | Can review and approve medium-risk quotes and manage sales teams. |
| **Finance** | `quinn.m@example.net` | Required to approve high-risk quotes involving large anomalies or steep discounts. |
| **Admin** | `beth.t@example.com` | Has global access, including configuring discount limits and system settings. |
| **Customer (Acme)** | `marco.r@example.org` | Client portal access to view/negotiate their specific quotations. |
| **Customer (Globex)**| `uma.s@example.org` | Client portal access for a different organization. |

---

## 🔄 Core Business Flow

### 1. Quotation Generation
Sales Representatives draft new quotations for customers. They can add hardware or service products to the quote and apply discounts.

### 2. Risk Assessment
Every quotation passes through a robust risk-scoring engine. Based on the requested discounts versus the configured limits (by tier and category), the deal is assigned a risk level:
- **LOW Risk**: Auto-approved.
- **MEDIUM Risk**: Requires approval from a Sales Manager.
- **HIGH Risk**: Requires approval from both a Sales Manager and Finance.

### 3. Approvals Workflow
Approvers (Managers/Finance) receive pending quotes in their dashboard. They can:
- **Approve**: Moves the quote to the customer.
- **Reject**: Declines the terms entirely.
- **Return**: Sends it back to the Sales Rep for revision.

### 4. Customer Negotiation (Portal)
Once approved internally, customers log into their dedicated portal to view the quotation. They can accept it as-is or propose counter-discounts and add notes. Any changes trigger a negotiation phase, routing the quote back to the internal team for review. Real-time updates via **Socket.IO** ensure seamless collaboration.

### 5. Fulfillment & Subscriptions
Upon confirmation:
- **Fulfillment**: Orders are split across warehouses, with logic to handle low stock.
- **Subscriptions**: Recurring products generate subscription ledgers and periodic invoices.

### 6. Health & Analytics
The system tracks "Deal Health," flagging stalled deals, discount anomalies, and delivery slippages to help managers coach reps and rescue at-risk deals.

---

### 💻 Two-Laptop Live Demo Example

Want to see the real-time negotiation in action?

1. **Laptop A (Manager)**: Log in as `olivia.t@example.org`. Open **Approvals** → **Q-1045 Acme Corp**.
2. **Laptop B (Customer)**: Log in as `marco.r@example.org`. Open **Q-1045**, change a counter discount, and click **Submit Request**.
3. **Observation**: Laptop A updates instantly via WebSockets (with a 3-second polling fallback) to reflect the customer's changes.
