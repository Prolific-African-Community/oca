const baseUrl = (process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3000').replace(
  /\/$/,
  ''
)
const password = process.env.SMOKE_PASSWORD || process.env.SEED_PASSWORD

if (!password) {
  throw new Error('SMOKE_PASSWORD or SEED_PASSWORD is required')
}

interface Session {
  cookie: string
  user: {
    memberships: Array<{ institutionId: string; role: string }>
  }
}

async function request(
  path: string,
  options: RequestInit & { cookie?: string } = {}
) {
  const headers = new Headers(options.headers)
  if (options.cookie) headers.set('Cookie', options.cookie)
  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
    redirect: 'manual',
  })
}

async function login(email: string): Promise<Session> {
  const response = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (response.status !== 200) {
    throw new Error(`Login failed for ${email}: HTTP ${response.status}`)
  }
  const setCookie = response.headers.get('set-cookie') || ''
  const token = /oca_session=([^;]+)/.exec(setCookie)?.[1]
  if (!token) throw new Error(`Session cookie missing for ${email}`)
  const payload = (await response.json()) as { user: Session['user'] }
  return { cookie: `oca_session=${token}`, user: payload.user }
}

async function expectStatus(
  label: string,
  path: string,
  expected: number,
  cookie?: string
) {
  const response = await request(path, { cookie })
  if (response.status !== expected) {
    throw new Error(
      `${label}: expected ${expected}, received ${response.status}`
    )
  }
  console.log(`PASS ${label} (${response.status})`)
  return response
}

async function main() {
  const [superadmin, admin, professor, student] = await Promise.all([
    login('superadmin@oca.africa'),
    login('admin@universite-test.oca.africa'),
    login('professeur@universite-test.oca.africa'),
    login('etudiant@universite-test.oca.africa'),
  ])

  await expectStatus('anonymous protected page redirect', '/admin', 307)
  await expectStatus('wrong-role page redirect', '/admin', 307, student.cookie)
  await expectStatus(
    'superadmin protected API',
    '/api/superadmin/overview',
    200,
    superadmin.cookie
  )
  await expectStatus(
    'admin protected API',
    '/api/admin/structure',
    200,
    admin.cookie
  )
  await expectStatus(
    'teacher protected API',
    '/api/teacher/courses',
    200,
    professor.cookie
  )
  await expectStatus(
    'student protected API',
    '/api/student/courses',
    200,
    student.cookie
  )
  await expectStatus(
    'student rejected from teacher API',
    '/api/teacher/courses',
    403,
    student.cookie
  )

  const adminInstitution = admin.user.memberships.find(
    (membership) => membership.role === 'ADMIN'
  )?.institutionId
  if (!adminInstitution) throw new Error('Seeded admin membership missing')

  const scopedResponse = await expectStatus(
    'client tenant override ignored',
    '/api/admin/structure?institutionId=foreign-tenant',
    200,
    admin.cookie
  )
  const scoped = (await scopedResponse.json()) as {
    institution: { id: string } | null
  }
  if (scoped.institution?.id !== adminInstitution) {
    throw new Error('Tenant scope did not come from the authenticated session')
  }
  console.log('PASS tenant response matches authenticated membership')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
