import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { indexRoute } from '../../src/routes/index'

describe('indexRoute', () => {
  it('returns HTML for the homepage', async () => {
    const app = new Hono()
    app.route('/', indexRoute)

    const res = await app.request('http://localhost:8787/')

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')
    const html = await res.text()
    expect(html).toContain('My App')
    expect(html).toContain('Sign in or create an account to continue.')
  })

  it('returns the dashboard page with session-aware account UI', async () => {
    const app = new Hono()
    app.route('/', indexRoute)

    const res = await app.request('http://localhost:8787/dashboard')

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')
    const html = await res.text()
    expect(html).toContain('Dashboard | My App')
    expect(html).toContain('Welcome, ')
    expect(html).toContain('fetch(\'/api/auth/me\'')
    expect(html).toContain('window.location.replace(\'/\')')
  })
  
  it('returns the sensor monitor page', async () => {
    const app = new Hono()
    app.route('/', indexRoute)
    
    const res = await app.request('http://localhost:8787/sensors')
    
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('Sensor Monitor | My App')
    expect(html).toContain('Temperature trend')
    expect(html).toContain('/api/sensors/readings')
  })
})
