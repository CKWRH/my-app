import { Hono } from 'hono'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { AppShell } from '../components/AppShell'
import type { CloudflareBindings } from '../lib/env'

export const indexRoute = new Hono<{ Bindings: CloudflareBindings }>()

const authUi = `
  <div style="max-width: 460px; margin: 64px auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 16px; background: white; box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);">
    <h1 style="margin-top: 0; font-size: 2rem;">My App</h1>
    <p style="color: #475569; margin-bottom: 24px;">Sign in or create an account to continue.</p>
    <div id="auth-status" style="margin-bottom: 16px; color: #0f172a; font-weight: 600;">Checking session...</div>
    <form id="auth-form" style="display: grid; gap: 12px;">
      <input id="auth-email" name="email" type="email" placeholder="Email" required style="padding: 12px 14px; border: 1px solid #cbd5e1; border-radius: 10px;" />
      <input id="auth-password" name="password" type="password" placeholder="Password" required style="padding: 12px 14px; border: 1px solid #cbd5e1; border-radius: 10px;" />
      <input id="auth-display-name" name="displayName" type="text" placeholder="Display name" style="padding: 12px 14px; border: 1px solid #cbd5e1; border-radius: 10px;" />
      <div style="display: flex; gap: 12px;">
        <button id="login-btn" type="submit" style="flex: 1; background: #0f172a; color: white; border: none; border-radius: 10px; padding: 12px; cursor: pointer;">Login</button>
        <button id="register-btn" type="button" style="flex: 1; background: #e2e8f0; color: #0f172a; border: none; border-radius: 10px; padding: 12px; cursor: pointer;">Register</button>
      </div>
      <button id="logout-btn" type="button" style="display: none; background: #dc2626; color: white; border: none; border-radius: 10px; padding: 12px; cursor: pointer;">Logout</button>
    </form>
  </div>
  <script>
    const statusEl = document.getElementById('auth-status')
    const form = document.getElementById('auth-form')
    const emailInput = document.getElementById('auth-email')
    const passwordInput = document.getElementById('auth-password')
    const displayNameInput = document.getElementById('auth-display-name')
    const loginBtn = document.getElementById('login-btn')
    const registerBtn = document.getElementById('register-btn')
    const logoutBtn = document.getElementById('logout-btn')

    async function fetchJson(url, options = {}) {
      const response = await fetch(url, { credentials: 'same-origin', ...options })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || 'Request failed')
      }
      return { response, data }
    }

    async function updateSessionStatus() {
      try {
        const { data } = await fetchJson('/api/auth/me')
        statusEl.textContent = 'Logged in as ' + (data.user?.displayName || data.user?.email || 'user')
        logoutBtn.style.display = 'block'
      } catch {
        statusEl.textContent = 'No active session'
        logoutBtn.style.display = 'none'
      }
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault()
      loginBtn.disabled = true
      try {
        statusEl.textContent = 'Logging in...'
        await fetchJson('/api/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: emailInput.value, password: passwordInput.value })
        })
        window.location.assign('/dashboard')
      } catch (err) {
        statusEl.textContent = err.message || 'Login failed'
        loginBtn.disabled = false
      }
    })

    registerBtn.addEventListener('click', async () => {
      if (!form.reportValidity()) return
      try {
        statusEl.textContent = 'Registering...'
        await fetchJson('/api/auth/register', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            email: emailInput.value,
            password: passwordInput.value,
            displayName: displayNameInput.value || 'New User'
          })
        })
        statusEl.textContent = 'Registered. You can now log in.'
      } catch (err) {
        statusEl.textContent = err.message || 'Registration failed'
      }
    })

    logoutBtn.addEventListener('click', async () => {
      try {
        await fetchJson('/api/auth/logout', { method: 'POST' })
        statusEl.textContent = 'Logged out'
        logoutBtn.style.display = 'none'
      } catch (err) {
        statusEl.textContent = err.message || 'Logout failed'
      }
    })

    updateSessionStatus()
  </script>
`

const dashboardUi = `
  <section style="max-width: 1000px; margin: 36px auto; color: #17212b;">
    <header style="display: flex; align-items: center; justify-content: space-between; gap: 16px; border-bottom: 1px solid #d9e0e5; padding-bottom: 20px;">
      <div>
        <p style="margin: 0 0 8px; color: #52706d;">MY APP / DASHBOARD</p>
        <h1 id="welcome-heading" style="margin: 0;">Loading dashboard...</h1>
      </div>
      <nav style="display: flex; align-items: center; gap: 10px;">
        <a href="/sensors" style="color: #176b5b; font-weight: 700; text-decoration: none;">Sensor monitor</a>
        <button id="logout-btn" type="button" style="background: #17212b; color: white; border: 0; border-radius: 6px; padding: 10px 16px; cursor: pointer;">Logout</button>
      </nav>
    </header>
    <p id="dashboard-status" role="status" style="margin: 20px 0; color: #52706d;">Loading account...</p>
    <section style="padding: 20px 0; border-bottom: 1px solid #d9e0e5;">
      <h2 style="margin: 0 0 18px; font-size: 1.1rem;">Account</h2>
      <dl style="display: grid; grid-template-columns: minmax(100px, 150px) 1fr; gap: 12px; margin: 0;">
        <dt style="color: #52706d;">Email</dt><dd id="account-email" style="margin: 0;">Loading...</dd>
        <dt style="color: #52706d;">Display name</dt><dd id="account-name" style="margin: 0;">Loading...</dd>
        <dt style="color: #52706d;">Role</dt><dd id="account-role" style="margin: 0;">Loading...</dd>
      </dl>
    </section>
    <section style="display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(240px, 0.8fr); gap: 36px; padding: 24px 0; border-bottom: 1px solid #d9e0e5;">
      <div>
        <header style="display: flex; align-items: baseline; justify-content: space-between; gap: 16px;">
          <h2 style="margin: 0; font-size: 1.1rem;">Realtime chat</h2>
          <span id="chat-connection" style="color: #52706d;">Connecting...</span>
        </header>
        <p style="margin: 8px 0 14px; color: #52706d;">Room: general</p>
        <ol id="chat-messages" aria-live="polite" style="height: 280px; overflow-y: auto; list-style: none; padding: 0; margin: 0; border-top: 1px solid #d9e0e5;"></ol>
        <form id="chat-form" style="display: grid; grid-template-columns: 1fr auto; gap: 10px; padding-top: 12px;">
          <input id="chat-input" type="text" maxlength="2000" autocomplete="off" placeholder="Write a message" required style="min-width: 0; padding: 11px 12px; border: 1px solid #cbd5e1; border-radius: 5px;" />
          <button id="chat-send" type="submit" style="background: #176b5b; color: white; border: 0; border-radius: 5px; padding: 0 18px; cursor: pointer;">Send</button>
        </form>
      </div>
      <div>
        <h2 style="margin: 0 0 8px; font-size: 1.1rem;">Saved messages</h2>
        <p style="margin: 0 0 14px; color: #52706d;">Recent records stored in D1.</p>
        <ol id="saved-messages" style="max-height: 340px; overflow-y: auto; list-style: none; padding: 0; margin: 0;"></ol>
      </div>
    </section>
    <section id="admin-section" hidden style="padding: 24px 0;">
      <header style="display: flex; align-items: baseline; justify-content: space-between; gap: 16px;">
        <h2 style="margin: 0; font-size: 1.1rem;">User administration</h2>
        <span id="admin-status" role="status" style="color: #52706d;"></span>
      </header>
      <div style="overflow-x: auto; margin-top: 16px;">
        <table style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead><tr><th style="padding: 10px; border-bottom: 1px solid #d9e0e5;">User</th><th style="padding: 10px; border-bottom: 1px solid #d9e0e5;">Role</th><th style="padding: 10px; border-bottom: 1px solid #d9e0e5;">Status</th><th style="padding: 10px; border-bottom: 1px solid #d9e0e5;">Action</th></tr></thead>
          <tbody id="admin-users"></tbody>
        </table>
      </div>
    </section>
  </section>
  <script>
    const statusEl = document.getElementById('dashboard-status')
    const logoutBtn = document.getElementById('logout-btn')
    const chatStatus = document.getElementById('chat-connection')
    const chatMessages = document.getElementById('chat-messages')
    const savedMessages = document.getElementById('saved-messages')
    const chatForm = document.getElementById('chat-form')
    const chatInput = document.getElementById('chat-input')
    const adminSection = document.getElementById('admin-section')
    const adminUsers = document.getElementById('admin-users')
    const adminStatus = document.getElementById('admin-status')
    let socket

    function addMessage(list, message) {
      const item = document.createElement('li')
      item.style.cssText = 'padding: 11px 4px; border-bottom: 1px solid #e5eaed; overflow-wrap: anywhere;'
      const author = document.createElement('strong')
      author.textContent = message.display_name + ' '
      const body = document.createElement('span')
      body.textContent = message.content
      const timestamp = document.createElement('time')
      timestamp.dateTime = message.created_at
      timestamp.textContent = new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      timestamp.style.cssText = 'display: block; margin-top: 4px; color: #718088; font-size: 0.8rem;'
      item.append(author, body, timestamp)
      list.append(item)
      list.scrollTop = list.scrollHeight
    }

    async function loadSavedMessages() {
      const response = await fetch('/api/chat/general/messages', { credentials: 'same-origin' })
      if (!response.ok) throw new Error('Could not load saved messages')
      const { messages } = await response.json()
      savedMessages.replaceChildren()
      messages.forEach((message) => addMessage(savedMessages, message))
    }

    function connectChat() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      socket = new WebSocket(protocol + '//' + window.location.host + '/api/realtime/general')
      socket.addEventListener('open', () => { chatStatus.textContent = 'Live' })
      socket.addEventListener('close', () => { chatStatus.textContent = 'Disconnected' })
      socket.addEventListener('error', () => { chatStatus.textContent = 'Connection error' })
      socket.addEventListener('message', (event) => {
        const frame = JSON.parse(event.data)
        if (frame.type === 'message') {
          addMessage(chatMessages, frame.message)
          addMessage(savedMessages, frame.message)
        } else if (frame.type === 'error') {
          chatStatus.textContent = frame.error
        }
      })
    }

    chatForm.addEventListener('submit', (event) => {
      event.preventDefault()
      const content = chatInput.value.trim()
      if (!content || !socket || socket.readyState !== WebSocket.OPEN) {
        chatStatus.textContent = 'Chat is not connected'
        return
      }
      socket.send(JSON.stringify({ content }))
      chatInput.value = ''
    })

    async function loadAdminUsers() {
      const response = await fetch('/api/admin/users', { credentials: 'same-origin' })
      if (!response.ok) throw new Error('Could not load users')
      const { users } = await response.json()
      adminUsers.replaceChildren()
      users.forEach((user) => {
        const row = document.createElement('tr')
        const identity = document.createElement('td')
        identity.textContent = user.display_name + ' · ' + user.email
        const role = document.createElement('td')
        role.textContent = user.role
        const status = document.createElement('td')
        status.textContent = user.is_active ? 'Active' : 'Disabled'
        const action = document.createElement('td')
        const button = document.createElement('button')
        button.type = 'button'
        button.textContent = user.is_active ? 'Disable' : 'Enable'
        button.disabled = user.id === document.getElementById('account-email').dataset.userId
        button.style.cssText = 'background: transparent; border: 1px solid #9eaaa9; border-radius: 4px; padding: 6px 10px; cursor: pointer;'
        button.addEventListener('click', async () => {
          button.disabled = true
          try {
            const update = await fetch('/api/admin/users/' + encodeURIComponent(user.id) + '/status', {
              method: 'PATCH',
              credentials: 'same-origin',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ isActive: !user.is_active })
            })
            if (!update.ok) throw new Error('Could not update account status')
            await loadAdminUsers()
            adminStatus.textContent = 'Account status updated.'
          } catch (error) {
            adminStatus.textContent = error.message || 'Could not update account status'
            button.disabled = false
          }
        })
        action.append(button)
        ;[identity, role, status, action].forEach((cell) => {
          cell.style.cssText = 'padding: 10px; border-bottom: 1px solid #e5eaed;'
          row.append(cell)
        })
        adminUsers.append(row)
      })
    }

    async function loadDashboard() {
      try {
        const response = await fetch('/api/auth/me', { credentials: 'same-origin' })
        if (response.status === 401) {
          window.location.replace('/')
          return
        }
        if (!response.ok) throw new Error('Could not load account')

        const { user } = await response.json()
        document.getElementById('welcome-heading').textContent = 'Welcome, ' + (user.display_name || user.email)
        document.getElementById('account-email').textContent = user.email
        document.getElementById('account-email').dataset.userId = user.id
        document.getElementById('account-name').textContent = user.display_name
        document.getElementById('account-role').textContent = user.role
        statusEl.textContent = 'You are signed in.'
        await loadSavedMessages()
        connectChat()
        if (user.role === 'admin') {
          adminSection.hidden = false
          await loadAdminUsers()
        }
      } catch (error) {
        statusEl.textContent = error.message || 'Could not load account'
      }
    }

    logoutBtn.addEventListener('click', async () => {
      logoutBtn.disabled = true
      try {
        const response = await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'same-origin'
        })
        if (!response.ok) throw new Error('Could not log out')
        window.location.assign('/')
      } catch (error) {
        statusEl.textContent = error.message || 'Could not log out'
        logoutBtn.disabled = false
      }
    })

    loadDashboard()
  </script>
`

const sensorUi = `
  <style>
    :root { color-scheme: light; --ink: #1b2a25; --muted: #64736d; --line: #d9e3dd; --paper: #f2f6f2; --green: #176b5b; --lime: #c6d978; --rust: #bd5c3b; }
    body { background: linear-gradient(145deg, #eef4ef, #f8f6ed 72%); color: var(--ink); font-family: 'Aptos', 'Segoe UI', sans-serif; }
    .sensor-page { max-width: 1120px; margin: 12px auto 48px; }
    .sensor-header { display: flex; justify-content: space-between; align-items: end; gap: 20px; border-bottom: 1px solid var(--line); padding: 12px 0 22px; }
    .sensor-header h1 { margin: 0; font-size: 2rem; font-weight: 650; }
    .sensor-kicker { margin: 0 0 8px; color: var(--green); font-size: .78rem; font-weight: 700; }
    .sensor-subtitle { margin: 8px 0 0; color: var(--muted); }
    .sensor-nav { display: flex; align-items: center; gap: 14px; }
    .sensor-nav a { color: var(--green); font-weight: 700; text-decoration: none; }
    .sensor-button { min-height: 40px; padding: 9px 14px; border: 0; border-radius: 5px; background: var(--green); color: white; font: inherit; font-weight: 700; cursor: pointer; }
    .sensor-button:disabled { cursor: wait; opacity: .65; }
    .sensor-status { min-height: 24px; margin: 14px 0; color: var(--muted); }
    .sensor-metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .sensor-metric { min-height: 124px; padding: 18px; border: 1px solid var(--line); border-radius: 7px; background: rgba(255,255,255,.82); }
    .sensor-metric-label { color: var(--muted); font-size: .85rem; }
    .sensor-metric-value { display: block; margin-top: 12px; font-size: 2rem; line-height: 1.1; font-weight: 700; }
    .sensor-metric-note { display: block; margin-top: 7px; color: var(--muted); font-size: .8rem; }
    .sensor-content { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(280px, .85fr); gap: 32px; margin-top: 28px; }
    .sensor-section { min-width: 0; }
    .sensor-section h2 { margin: 0; font-size: 1.12rem; }
    .sensor-section-intro { margin: 6px 0 18px; color: var(--muted); font-size: .9rem; }
    .sensor-chart { display: flex; align-items: end; gap: 5px; height: 132px; padding: 12px 4px 0; border-bottom: 1px solid var(--line); }
    .sensor-bar { flex: 1; min-width: 3px; max-width: 22px; border-radius: 3px 3px 0 0; background: linear-gradient(0deg, var(--green), #89a98b); }
    .sensor-chart-empty { align-self: center; color: var(--muted); }
    .sensor-chart-caption { display: flex; justify-content: space-between; margin-top: 8px; color: var(--muted); font-size: .78rem; }
    .sensor-form { display: grid; gap: 12px; padding: 18px; border: 1px solid var(--line); border-radius: 7px; background: rgba(255,255,255,.72); }
    .sensor-form label { display: grid; gap: 6px; color: var(--muted); font-size: .84rem; }
    .sensor-form input, .sensor-form select { width: 100%; box-sizing: border-box; min-height: 40px; padding: 8px 10px; border: 1px solid #cbd7d0; border-radius: 4px; background: white; color: var(--ink); font: inherit; }
    .sensor-form .sensor-button { margin-top: 4px; }
    .sensor-history { margin-top: 30px; }
    .sensor-table-wrap { overflow-x: auto; }
    .sensor-table { width: 100%; border-collapse: collapse; text-align: left; font-size: .9rem; }
    .sensor-table th { padding: 11px 10px; color: var(--muted); font-size: .78rem; font-weight: 700; }
    .sensor-table td { padding: 12px 10px; border-top: 1px solid var(--line); white-space: nowrap; }
    .sensor-pill { display: inline-block; padding: 4px 8px; border-radius: 99px; background: #e5efe9; color: #176b5b; font-size: .76rem; font-weight: 700; text-transform: capitalize; }
    .sensor-pill.error { background: #f8e8df; color: #9f422a; }
    @media (max-width: 760px) { body { padding: 16px !important; } .sensor-header { align-items: start; flex-direction: column; } .sensor-content { grid-template-columns: 1fr; gap: 26px; } .sensor-metrics { gap: 8px; } .sensor-metric { min-height: 108px; padding: 12px; } .sensor-metric-value { font-size: 1.55rem; } .sensor-nav { width: 100%; justify-content: space-between; } }
    @media (max-width: 420px) { .sensor-metrics { grid-template-columns: 1fr; } .sensor-metric { min-height: auto; } .sensor-metric-value { margin-top: 7px; } }
  </style>
  <main class="sensor-page">
    <header class="sensor-header">
      <div>
        <p class="sensor-kicker">FIELD SYSTEMS / TELEMETRY</p>
        <h1>Sensor monitor</h1>
        <p class="sensor-subtitle">Temperature, stepper state and servo position</p>
      </div>
      <nav class="sensor-nav">
        <a href="/dashboard">Dashboard</a>
        <button id="sensor-refresh" class="sensor-button" type="button">Refresh data</button>
      </nav>
    </header>
    <p id="sensor-status" class="sensor-status" role="status">Loading readings from D1...</p>
    <section class="sensor-metrics" aria-label="Latest sensor values">
      <article class="sensor-metric"><span class="sensor-metric-label">Temperature</span><strong id="metric-temperature" class="sensor-metric-value">--</strong><span id="metric-temperature-note" class="sensor-metric-note">No readings yet</span></article>
      <article class="sensor-metric"><span class="sensor-metric-label">Stepper motor</span><strong id="metric-stepper" class="sensor-metric-value">--</strong><span id="metric-stepper-note" class="sensor-metric-note">Current status</span></article>
      <article class="sensor-metric"><span class="sensor-metric-label">Servo position</span><strong id="metric-servo" class="sensor-metric-value">--</strong><span id="metric-servo-note" class="sensor-metric-note">0° to 180° range</span></article>
    </section>
    <div class="sensor-content">
      <section class="sensor-section" aria-labelledby="trend-heading">
        <h2 id="trend-heading">Temperature trend</h2>
        <p class="sensor-section-intro">Recent samples, oldest to newest · °C</p>
        <div id="temperature-chart" class="sensor-chart" role="img" aria-label="Temperature history chart"><span class="sensor-chart-empty">Waiting for the first reading</span></div>
        <div class="sensor-chart-caption"><span id="chart-low">Min --</span><span id="chart-high">Max --</span></div>
        <section class="sensor-history">
          <h2>Reading history</h2>
          <p class="sensor-section-intro">Latest 30 records stored in D1</p>
          <div class="sensor-table-wrap">
            <table class="sensor-table">
              <thead><tr><th>Recorded</th><th>Device</th><th>Temp</th><th>Stepper</th><th>Servo</th></tr></thead>
              <tbody id="sensor-history"></tbody>
            </table>
          </div>
        </section>
      </section>
      <section class="sensor-section" aria-labelledby="sample-heading">
        <h2 id="sample-heading">Record a reading</h2>
        <p class="sensor-section-intro">Submit a sensor sample to the authenticated D1 API.</p>
        <form id="sensor-form" class="sensor-form">
          <label>Device ID<input name="deviceId" value="bench-01" maxlength="64" pattern="[A-Za-z0-9_\\x2d]+" required /></label>
          <label>Temperature (°C)<input name="temperatureC" type="number" min="-40" max="125" step="0.1" placeholder="24.5" required /></label>
          <label>Stepper status<select name="stepperStatus"><option value="stopped">Stopped</option><option value="moving">Moving</option><option value="error">Error</option></select></label>
          <label>Servo angle (°)<input name="servoAngle" type="number" min="0" max="180" step="1" placeholder="90" required /></label>
          <button id="sensor-submit" class="sensor-button" type="submit">Save reading</button>
        </form>
      </section>
    </div>
  </main>
  <script>
    const sensorStatus = document.getElementById('sensor-status')
    const sensorHistory = document.getElementById('sensor-history')
    const sensorForm = document.getElementById('sensor-form')
    const sensorSubmit = document.getElementById('sensor-submit')

    function formatRecordedAt(value) {
      return new Date(value.replace(' ', 'T') + (value.endsWith('Z') ? '' : 'Z')).toLocaleString()
    }

    function createCell(text) {
      const cell = document.createElement('td')
      cell.textContent = text
      return cell
    }

    function renderReadings(readings) {
      const latest = readings[0]
      document.getElementById('metric-temperature').textContent = latest ? Number(latest.temperature_c).toFixed(1) + '°C' : '--'
      document.getElementById('metric-temperature-note').textContent = latest ? 'Device ' + latest.device_id : 'No readings yet'
      document.getElementById('metric-stepper').textContent = latest ? latest.stepper_status : '--'
      document.getElementById('metric-stepper-note').textContent = latest ? 'Device ' + latest.device_id : 'Current status'
      document.getElementById('metric-servo').textContent = latest ? Number(latest.servo_angle).toFixed(0) + '°' : '--'
      document.getElementById('metric-servo-note').textContent = latest ? 'Updated ' + formatRecordedAt(latest.recorded_at) : '0° to 180° range'

      const chart = document.getElementById('temperature-chart')
      chart.replaceChildren()
      const chartReadings = readings.slice(0, 30).reverse()
      if (!chartReadings.length) {
        const empty = document.createElement('span')
        empty.className = 'sensor-chart-empty'
        empty.textContent = 'Waiting for the first reading'
        chart.append(empty)
        document.getElementById('chart-low').textContent = 'Min --'
        document.getElementById('chart-high').textContent = 'Max --'
      } else {
        const values = chartReadings.map((reading) => Number(reading.temperature_c))
        const low = Math.min(...values)
        const high = Math.max(...values)
        chartReadings.forEach((reading) => {
          const value = Number(reading.temperature_c)
          const bar = document.createElement('span')
          bar.className = 'sensor-bar'
          bar.style.height = (high === low ? 52 : 18 + ((value - low) / (high - low)) * 82) + '%'
          bar.title = value.toFixed(1) + '°C · ' + formatRecordedAt(reading.recorded_at)
          bar.setAttribute('aria-label', bar.title)
          chart.append(bar)
        })
        document.getElementById('chart-low').textContent = 'Min ' + low.toFixed(1) + '°C'
        document.getElementById('chart-high').textContent = 'Max ' + high.toFixed(1) + '°C'
      }

      sensorHistory.replaceChildren()
      readings.forEach((reading) => {
        const row = document.createElement('tr')
        row.append(createCell(formatRecordedAt(reading.recorded_at)))
        row.append(createCell(reading.device_id))
        row.append(createCell(Number(reading.temperature_c).toFixed(1) + '°C'))
        const stateCell = document.createElement('td')
        const state = document.createElement('span')
        state.className = 'sensor-pill' + (reading.stepper_status === 'error' ? ' error' : '')
        state.textContent = reading.stepper_status
        stateCell.append(state)
        row.append(stateCell)
        row.append(createCell(Number(reading.servo_angle).toFixed(0) + '°'))
        sensorHistory.append(row)
      })
    }

    async function loadReadings() {
      sensorStatus.textContent = 'Loading readings from D1...'
      const response = await fetch('/api/sensors/readings?limit=30', { credentials: 'same-origin' })
      if (response.status === 401) {
        window.location.replace('/')
        return
      }
      if (!response.ok) throw new Error('Could not load sensor readings')
      const { readings } = await response.json()
      renderReadings(readings)
      sensorStatus.textContent = readings.length ? readings.length + ' recent readings · sourced from D1' : 'No readings recorded yet'
    }

    document.getElementById('sensor-refresh').addEventListener('click', async () => {
      try { await loadReadings() } catch (error) { sensorStatus.textContent = error.message || 'Could not load sensor readings' }
    })

    sensorForm.addEventListener('submit', async (event) => {
      event.preventDefault()
      if (!sensorForm.reportValidity()) return
      const formData = new FormData(sensorForm)
      sensorSubmit.disabled = true
      sensorSubmit.textContent = 'Saving...'
      try {
        const response = await fetch('/api/sensors/readings', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            deviceId: formData.get('deviceId'),
            temperatureC: Number(formData.get('temperatureC')),
            stepperStatus: formData.get('stepperStatus'),
            servoAngle: Number(formData.get('servoAngle'))
          })
        })
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.error || 'Could not save reading')
        sensorForm.elements.temperatureC.value = ''
        sensorForm.elements.servoAngle.value = ''
        await loadReadings()
        sensorStatus.textContent = 'Reading saved to D1'
      } catch (error) {
        sensorStatus.textContent = error.message || 'Could not save reading'
      } finally {
        sensorSubmit.disabled = false
        sensorSubmit.textContent = 'Save reading'
      }
    })

    loadReadings().catch((error) => { sensorStatus.textContent = error.message || 'Could not load sensor readings' })
  </script>
`

indexRoute.get('/', async (c) => {
  const html = renderToString(
    React.createElement(
      AppShell,
      {
        title: 'My App',
        children: React.createElement('div', {
          dangerouslySetInnerHTML: { __html: authUi },
        }),
      }
    )
  )

  return c.html(`<!DOCTYPE html>${html}`)
})

indexRoute.get('/dashboard', async (c) => {
  const html = renderToString(
    React.createElement(
      AppShell,
      {
        title: 'Dashboard | My App',
        children: React.createElement('div', {
          dangerouslySetInnerHTML: { __html: dashboardUi },
        }),
      }
    )
  )

  return c.html(`<!DOCTYPE html>${html}`)
})

indexRoute.get('/sensors', async (c) => {
  const html = renderToString(
    React.createElement(
      AppShell,
      {
        title: 'Sensor Monitor | My App',
        children: React.createElement('div', {
          dangerouslySetInnerHTML: { __html: sensorUi },
        }),
      }
    )
  )

  return c.html(`<!DOCTYPE html>${html}`)
})

indexRoute.get('/health', (c) => c.json({ ok: true, app: c.env.APP_NAME }))
