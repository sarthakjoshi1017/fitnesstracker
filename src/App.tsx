import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Bell, Bike, CalendarDays,
  Check, ChevronDown, ChevronRight, CircleHelp, Clock3, Dumbbell,
  Flame, HeartPulse, Lightbulb, LogOut, Menu, MoreHorizontal, Plus, Search,
  Settings2, Sparkles, Target, TrendingUp, Utensils, Weight, X,
} from 'lucide-react'
import {
  ArcElement, CategoryScale, Chart as ChartJS, Filler, Legend, LinearScale,
  LineElement, PointElement, Tooltip, type ChartData, type ChartOptions,
} from 'chart.js'
import { Doughnut, Line } from 'react-chartjs-2'
import { useLocation, useNavigate } from 'react-router-dom'
import { normalizeOpenFoodFactsProduct, scaleNutrition, type FoodSearchResult } from './nutrition'
import './App.css'

ChartJS.register(ArcElement, CategoryScale, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip)

type Section = 'Overview' | 'Workouts' | 'Nutrition' | 'Progress' | 'Intelligence' | 'Meal builder'
type Workout = { id: string; title: string; focus: string; date: string; duration: number; volume: number; complete: boolean }
type Meal = { id: string; name: string; type: string; time: string; calories: number; protein: number; carbs: number; fat: number; quantity?: number; servingUnit?: string; serving?: string }
type FoodOption = { name: string; description: string; calories: number; protein: number; carbs: number; fat: number; tags: string[]; kind: string; serving: string; servingUnit: string; ingredients?: string[]; steps?: string[]; prepMinutes?: number; source?: string }
type SavedFood = Pick<FoodOption, 'name' | 'calories' | 'protein' | 'carbs' | 'fat' | 'serving'>
type WeightEntry = { date: string; value: number }
type ModalType = 'workout' | 'meal' | 'weight' | null

type AppData = { workouts: Workout[]; meals: Meal[]; weights: WeightEntry[]; calorieTarget?: number | null; proteinTarget?: number | null; carbsTarget?: number | null; fatTarget?: number | null }
type Account = { id?: string; name: string; email: string }

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api'
const SECTION_PATHS: Record<Section, string> = {
  Overview: '/', Workouts: '/workouts', Nutrition: '/nutrition', Progress: '/progress',
  Intelligence: '/intelligence', 'Meal builder': '/meals',
}

function sectionForPath(path: string): Section {
  return (Object.entries(SECTION_PATHS).find(([, route]) => route === path)?.[0] as Section | undefined) ?? 'Overview'
}

async function loadAccountData(): Promise<AppData> {
  const response = await fetch(`${API_URL}/dashboard`, { credentials: 'include' })
  const payload = await response.json() as {
    error?: string
    profile: { calorieTarget: number | null; proteinTarget: number | null } | null
    workouts: Array<{ id: string; title: string; focus: string; duration: number; volumeKg: number; startedAt: string }>
    meals: Array<{ id: string; name: string; type: string; quantity: string | number; servingUnit: string; servingDescription: string; calories: number; proteinG: string | number; carbsG: string | number; fatG: string | number; eatenAt: string }>
    weights: Array<{ id: string; weightKg: string | number; recordedAt: string }>
  }
  if (!response.ok) throw new Error(payload.error ?? 'Could not load your account data')
  return {
    calorieTarget: payload.profile?.calorieTarget ?? null,
    proteinTarget: payload.profile?.proteinTarget ?? null,
    carbsTarget: null,
    fatTarget: null,
    workouts: payload.workouts.map((workout) => ({
      id: workout.id, title: workout.title, focus: workout.focus, duration: workout.duration,
      volume: workout.volumeKg, date: new Date(workout.startedAt).toLocaleDateString(), complete: true,
    })),
    meals: payload.meals.map((meal) => ({
      id: meal.id, name: meal.name, type: meal.type.toLowerCase().replace(/^./, (char) => char.toUpperCase()),
      time: new Date(meal.eatenAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
      calories: meal.calories, protein: Number(meal.proteinG), carbs: Number(meal.carbsG), fat: Number(meal.fatG),
      quantity: Number(meal.quantity), servingUnit: meal.servingUnit, serving: meal.servingDescription,
    })),
    weights: payload.weights.map((entry) => ({
      date: new Date(entry.recordedAt).toLocaleDateString([], { month: 'short', day: 'numeric' }),
      value: Number(entry.weightKg),
    })),
  }
}

const sampleData: AppData = {
  calorieTarget: 2200,
  proteinTarget: 145,
  carbsTarget: 250,
  fatTarget: 70,
  workouts: [
    { id: 'w-1', title: 'Upper body strength', focus: 'Chest · Back · Shoulders', date: 'Today, 8:24 AM', duration: 58, volume: 6840, complete: true },
    { id: 'w-2', title: 'Lower body', focus: 'Quads · Glutes · Hamstrings', date: 'Yesterday, 6:10 PM', duration: 52, volume: 8920, complete: true },
    { id: 'w-3', title: 'Pull day', focus: 'Back · Biceps · Rear delts', date: 'Mon, Oct 24', duration: 49, volume: 6210, complete: true },
  ],
  meals: [
    { id: 'm-1', name: 'Greek yogurt & berries', type: 'Breakfast', time: '8:15 AM', calories: 320, protein: 28, carbs: 38, fat: 6 },
    { id: 'm-2', name: 'Chicken rice bowl', type: 'Lunch', time: '12:40 PM', calories: 640, protein: 46, carbs: 72, fat: 16 },
    { id: 'm-3', name: 'Protein shake', type: 'Snack', time: '3:25 PM', calories: 180, protein: 30, carbs: 8, fat: 3 },
  ],
  weights: [
    { date: 'Oct 20', value: 72.8 }, { date: 'Oct 21', value: 72.7 },
    { date: 'Oct 22', value: 72.9 }, { date: 'Oct 23', value: 72.5 },
    { date: 'Oct 24', value: 72.6 }, { date: 'Oct 25', value: 72.4 },
    { date: 'Today', value: 72.4 },
  ],
}

const navItems: { label: Section; icon: typeof Activity }[] = [
  { label: 'Overview', icon: Activity },
  { label: 'Workouts', icon: Dumbbell },
  { label: 'Nutrition', icon: Utensils },
  { label: 'Progress', icon: TrendingUp },
  { label: 'Intelligence', icon: Sparkles },
  { label: 'Meal builder', icon: Bike },
]
const STORAGE_KEY = 'fittrack-pro-demo-v1'
const CUSTOM_FOODS_KEY = 'fittrack-pro-custom-foods-v1'
const calorieTarget = 2200
const macroTarget = { protein: 145, carbs: 250, fat: 70 }

const foods: FoodOption[] = [
  { name: 'Paneer power bowl', description: 'Paneer · brown rice · spinach', calories: 520, protein: 32, carbs: 58, fat: 18, tags: ['Vegetarian', 'High protein'], kind: '🥗', serving: '1 bowl', servingUnit: 'bowl', prepMinutes: 15, ingredients: ['120 g paneer, cubed', '¾ cup cooked brown rice', '1 cup baby spinach', '½ cup bell pepper, sliced', '1 tsp olive oil', 'Lemon, salt, pepper, and cumin'], steps: ['Warm the olive oil in a pan. Season and sear the paneer until golden on both sides.', 'Add the bell pepper and cook for 3–4 minutes until just tender. Fold in the spinach until wilted.', 'Serve over warm brown rice. Finish with lemon juice and a pinch of cumin.'] },
  { name: 'Peanut butter oats', description: 'Oats · banana · peanut butter', calories: 430, protein: 18, carbs: 55, fat: 16, tags: ['Vegetarian', 'Quick'], kind: '🥣', serving: '1 bowl', servingUnit: 'bowl', prepMinutes: 10, ingredients: ['½ cup rolled oats', '1 cup milk or unsweetened alternative', '1 medium banana', '1 tbsp peanut butter', 'A pinch of cinnamon'], steps: ['Combine the oats and milk in a small saucepan. Simmer for 5 minutes, stirring occasionally, until creamy.', 'Slice the banana and stir half into the oats.', 'Transfer to a bowl and top with the remaining banana, peanut butter, and cinnamon.'] },
  { name: 'Chicken & rice plate', description: 'Chicken · basmati rice · greens', calories: 610, protein: 45, carbs: 68, fat: 14, tags: ['High protein', 'Balanced'], kind: '🍚', serving: '1 plate', servingUnit: 'plate', prepMinutes: 20, ingredients: ['150 g boneless chicken breast', '¾ cup cooked basmati rice', '1 cup mixed greens or vegetables', '1 tsp oil', 'Garlic, lemon, salt, and black pepper'], steps: ['Season the chicken with garlic, lemon, salt, and pepper.', 'Cook in a lightly oiled pan over medium heat until the thickest part reaches 74°C / 165°F; rest briefly and slice.', 'Serve with cooked basmati rice and greens. Keep sauces or added oil in mind when estimating nutrition.'] },
  { name: 'Lentil comfort bowl', description: 'Dal · roti · cucumber raita', calories: 480, protein: 24, carbs: 72, fat: 10, tags: ['Vegetarian', 'Budget friendly'], kind: '🍲', serving: '1 bowl', servingUnit: 'bowl', prepMinutes: 15, ingredients: ['¾ cup cooked lentils or dal', '1 whole-wheat roti', '½ cup plain yogurt', '½ cucumber, grated', 'Cumin, turmeric, salt, and coriander'], steps: ['Warm the cooked dal with turmeric, cumin, and a splash of water; simmer for 3–4 minutes.', 'Mix grated cucumber into plain yogurt and season lightly with salt and cumin.', 'Serve the dal with roti and cucumber raita.'] },
  { name: 'Cooked white rice', description: 'Plain cooked rice', calories: 205, protein: 4.3, carbs: 44.5, fat: 0.4, tags: ['Vegetarian', 'Staple'], kind: '🍚', serving: '1 cup (158 g)', servingUnit: 'cup' },
  { name: 'Roti / chapati', description: 'Plain whole-wheat roti', calories: 120, protein: 3.5, carbs: 20, fat: 3, tags: ['Vegetarian', 'Staple'], kind: '🫓', serving: '1 roti (40 g)', servingUnit: 'roti' },
  { name: 'Cooked lentils (dal)', description: 'Plain cooked lentils', calories: 230, protein: 18, carbs: 40, fat: 0.8, tags: ['Vegetarian', 'High protein'], kind: '🍲', serving: '1 cup (198 g)', servingUnit: 'cup' },
  { name: 'Paneer', description: 'Full-fat paneer, approximate', calories: 265, protein: 18.3, carbs: 1.2, fat: 20.8, tags: ['Vegetarian', 'High protein'], kind: '🧀', serving: '100 g', servingUnit: '100 g' },
  { name: 'Chicken breast', description: 'Cooked, skinless chicken breast', calories: 165, protein: 31, carbs: 0, fat: 3.6, tags: ['High protein', 'Cooked'], kind: '🍗', serving: '100 g', servingUnit: '100 g' },
  { name: 'Egg', description: 'One large boiled egg', calories: 78, protein: 6.3, carbs: 0.6, fat: 5.3, tags: ['Vegetarian', 'Quick'], kind: '🥚', serving: '1 large egg', servingUnit: 'egg' },
  { name: 'Banana', description: 'One medium banana', calories: 105, protein: 1.3, carbs: 27, fat: 0.4, tags: ['Vegetarian', 'Quick'], kind: '🍌', serving: '1 medium banana', servingUnit: 'banana' },
  { name: 'Milk', description: 'Whole cow’s milk, approximate', calories: 149, protein: 7.7, carbs: 11.7, fat: 8, tags: ['Vegetarian', 'Drink'], kind: '🥛', serving: '1 cup (244 ml)', servingUnit: 'cup' },
  { name: 'Oats', description: 'Dry rolled oats', calories: 150, protein: 5, carbs: 27, fat: 3, tags: ['Vegetarian', 'Staple'], kind: '🥣', serving: '40 g', servingUnit: '40 g' },
  { name: 'Greek yogurt', description: 'Plain, unsweetened yogurt', calories: 100, protein: 17, carbs: 6, fat: 0.7, tags: ['Vegetarian', 'High protein'], kind: '🥛', serving: '170 g cup', servingUnit: 'cup' },
]

function readStoredData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...sampleData, ...JSON.parse(raw) as Partial<AppData> } : sampleData
  } catch {
    return sampleData
  }
}

function readCustomFoods(): SavedFood[] {
  try {
    const raw = localStorage.getItem(CUSTOM_FOODS_KEY)
    if (!raw) return []
    const saved = JSON.parse(raw) as unknown
    if (!Array.isArray(saved)) throw new Error('Saved custom foods must be a list')
    return saved.filter((food: unknown): food is SavedFood => {
      if (typeof food !== 'object' || food === null) return false
      const candidate = food as Record<string, unknown>
      return typeof candidate.name === 'string' && candidate.name.trim().length > 0 &&
        typeof candidate.serving === 'string' && candidate.serving.trim().length > 0 &&
        [candidate.calories, candidate.protein, candidate.carbs, candidate.fat]
          .every((value) => typeof value === 'number' && Number.isFinite(value) && value >= 0)
    })
  } catch (error) {
    console.error('Could not load saved custom foods:', error)
    return []
  }
}

function dateLabel() {
  return new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())
}

function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const section = sectionForPath(location.pathname)
  const [data, setData] = useState<AppData>(readStoredData)
  const [customFoods, setCustomFoods] = useState<SavedFood[]>(readCustomFoods)
  const [modal, setModal] = useState<ModalType>(null)
  const [pendingFood, setPendingFood] = useState<FoodOption | null>(null)
  const [recipeFood, setRecipeFood] = useState<FoodOption | null>(null)
  const [accountModal, setAccountModal] = useState(false)
  const [account, setAccount] = useState<Account | null>(null)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [completedActions, setCompletedActions] = useState<string[]>([])

  useEffect(() => {
    if (!localStorage.getItem('fittrack-account-connected')) localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [data])

  useEffect(() => {
    localStorage.setItem(CUSTOM_FOODS_KEY, JSON.stringify(customFoods))
  }, [customFoods])

  useEffect(() => {
    if (!localStorage.getItem('fittrack-account-connected')) return
    void fetch(`${API_URL}/auth/me`, { credentials: 'include' }).then(async (response) => {
      const result = await response.json() as { error?: string; user?: Account }
      if (!response.ok || !result.user) throw new Error(result.error ?? 'Your session has expired')
      const loaded = await loadAccountData()
      setData(loaded)
      setAccount(result.user)
    }).catch((error: unknown) => {
      localStorage.removeItem('fittrack-account-connected')
      setAccount(null)
      setData(readStoredData())
      setNotice(error instanceof Error ? error.message : 'Could not reconnect to your account')
    })
  }, [])

  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(''), 3200)
    return () => window.clearTimeout(timeout)
  }, [notice])

  const todayMeals = data.meals
  const calories = todayMeals.reduce((sum, meal) => sum + meal.calories, 0)
  const protein = todayMeals.reduce((sum, meal) => sum + meal.protein, 0)
  const carbs = todayMeals.reduce((sum, meal) => sum + meal.carbs, 0)
  const fat = todayMeals.reduce((sum, meal) => sum + meal.fat, 0)
  const latestWeight = data.weights.at(-1)?.value ?? (account ? null : 72.4)
  const activeCalorieTarget = data.calorieTarget ?? (account ? null : calorieTarget)
  const activeProteinTarget = data.proteinTarget ?? (account ? null : macroTarget.protein)
  const activeCarbsTarget = data.carbsTarget ?? (account ? null : macroTarget.carbs)
  const activeFatTarget = data.fatTarget ?? (account ? null : macroTarget.fat)
  const weekWorkouts = data.workouts.filter((workout) => workout.complete).length

  function changeSection(next: Section) {
    navigate(SECTION_PATHS[next])
  }

  function openFoodLogger(food: FoodOption | null = null) {
    setPendingFood(food)
    setModal('meal')
  }

  async function saveToAccount(path: string, body: Record<string, unknown>) {
    if (!account) return true
    try {
      const response = await fetch(`${API_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      const result = await response.json() as { error?: string }
      if (!response.ok) throw new Error(result.error ?? 'Your entry could not be saved')
      return true
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'The service could not be reached. Please try again.')
      return false
    }
  }

  function updateData(next: AppData) {
    setData(next)
    setNotice('Your progress has been saved')
  }

  async function addWorkout(workout: Omit<Workout, 'id' | 'date' | 'complete'>) {
    if (!(await saveToAccount('/workouts', { title: workout.title, focus: workout.focus, duration: workout.duration, volumeKg: workout.volume }))) return
    updateData({ ...data, workouts: [{ ...workout, id: crypto.randomUUID(), date: 'Just now', complete: true }, ...data.workouts] })
  }
  async function addMeal(meal: Omit<Meal, 'id' | 'time'>): Promise<boolean> {
    if (!(await saveToAccount('/meals', {
      name: meal.name, type: meal.type.toUpperCase(), calories: meal.calories,
      proteinG: meal.protein, carbsG: meal.carbs, fatG: meal.fat,
      quantity: meal.quantity ?? 1, servingUnit: meal.servingUnit ?? 'serving',
      servingDescription: meal.serving ?? '1 serving',
    }))) return false
    updateData({ ...data, meals: [...data.meals, { ...meal, id: crypto.randomUUID(), time: new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(new Date()) }] })
    return true
  }
  async function addWeight(value: number) {
    if (!(await saveToAccount('/measurements/bodyweight', { weightKg: value }))) return
    updateData({ ...data, weights: [...data.weights, { date: 'Today', value }] })
  }

  async function authenticate(mode: 'login' | 'register', input: { name?: string; email: string; password: string }) {
    try {
      const response = await fetch(`${API_URL}/auth/${mode}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(input),
      })
      const result = await response.json() as { error?: string; user?: Account }
      if (!response.ok || !result.user) throw new Error(result.error ?? 'Could not sign in')
      const accountData = await loadAccountData()
      localStorage.setItem('fittrack-account-connected', 'true')
      setAccount(result.user)
      setData(accountData)
      setAccountModal(false)
      setNotice('You’re connected to your account')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not connect to the account service')
    }
  }

  async function logout() {
    let message = 'Signed out. You’re back in the demo workspace.'
    try {
      const response = await fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' })
      if (!response.ok) message = 'Signed out here, but the server could not confirm session revocation.'
    } catch {
      message = 'Signed out here, but the server could not confirm session revocation.'
    }
    localStorage.removeItem('fittrack-account-connected')
    setAccount(null)
    setData(readStoredData())
    setAccountModal(false)
    setNotice(message)
  }

  function toggleAction(id: string) {
    setCompletedActions((previous) => previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id])
    setNotice(completedActions.includes(id) ? 'Insight moved back to your list' : 'Insight marked as done')
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNavOpen ? 'sidebar-open' : ''}`}>
        <div className="brand-lockup">
          <div className="brand-mark"><Activity size={20} strokeWidth={2.5} /></div>
          <span>fittrack<span className="brand-pro">pro</span></span>
          <button className="icon-button mobile-close" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)}><X size={19} /></button>
        </div>

        <div className="workspace-label">WORKSPACE</div>
        <nav className="primary-nav" aria-label="Main navigation">
          {navItems.map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-link ${section === label ? 'nav-link-active' : ''}`} onClick={() => { changeSection(label); setMobileNavOpen(false) }}>
              <Icon size={18} strokeWidth={1.9} /><span>{label}</span>
              {label === 'Intelligence' && <span className="nav-badge">3</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-divider" />
        <div className="workspace-label">YOUR PLAN</div>
        <div className="goal-card">
          <div className="goal-card-top"><div className="goal-icon"><Target size={16} /></div><span>{account ? 'Your plan' : 'Lean muscle'}</span><MoreHorizontal size={18} className="muted-icon" /></div>
          <div className="goal-number">{account ? latestWeight?.toFixed(1) ?? '—' : '72.4'} <span>{account ? latestWeight === null ? '' : 'kg' : 'kg'}</span></div>
          <div className="goal-progress"><span style={{ width: account ? '0%' : '64%' }} /></div>
          <div className="goal-caption"><span>{account ? 'Latest weight' : 'Current'}</span><span>{account ? 'No goal set' : '75 kg goal'}</span></div>
        </div>

        <div className="sidebar-spacer" />
        <div className="sidebar-tip">
          <div className="tip-spark"><Sparkles size={15} /></div>
          <p><strong>Small steps add up.</strong><br />You're building a good rhythm. Keep showing up.</p>
          <div className="tip-dots"><i /><i /><i /></div>
        </div>
        <button className="nav-link sidebar-settings" onClick={() => setNotice('Settings are coming soon — your data is saved on this device.')}><Settings2 size={18} /><span>Settings</span></button>
        <div className="profile-row">
          <div className="avatar">SJ</div>
          <div className="profile-copy"><strong>{account?.name ?? 'Sarthak Joshi'}</strong><span>{account ? 'Connected account' : 'Demo account'}</span></div>
          <button className="icon-button" aria-label={account ? 'Sign out' : 'Connect account'} onClick={account ? logout : () => setAccountModal(true)}>{account ? <LogOut size={15} /> : <ChevronDown size={16} />}</button>
        </div>
      </aside>

      {mobileNavOpen && <button className="mobile-scrim" aria-label="Close navigation overlay" onClick={() => setMobileNavOpen(false)} />}
      <main className="main-area">
        <header className="topbar">
          <button className="icon-button menu-trigger" aria-label="Open navigation" onClick={() => setMobileNavOpen(true)}><Menu size={20} /></button>
          <div className="breadcrumb"><span>Workspace</span><ChevronRight size={15} /><strong>{section}</strong></div>
          <div className="topbar-actions">
            <button className="demo-pill" onClick={() => account ? changeSection('Overview') : setAccountModal(true)}><span /> {account ? account.email : <><span className="demo-desktop-label">Demo workspace</span><span className="demo-mobile-label">Demo</span></>}</button>
            <button className="icon-button search-button" aria-label="Search workouts" onClick={() => changeSection('Workouts')}><Search size={18} /></button>
            <button className="icon-button notification-button" aria-label="Notifications" onClick={() => changeSection('Intelligence')}><Bell size={18} /><i /></button>
            <div className="topbar-avatar">SJ</div>
          </div>
        </header>

        <div className="page-content">
          {section === 'Overview' && <Dashboard
            calories={calories} protein={protein} carbs={carbs} fat={fat} latestWeight={latestWeight} goalWeight={account ? null : 75} calorieTarget={activeCalorieTarget} proteinTarget={activeProteinTarget} carbsTarget={activeCarbsTarget} fatTarget={activeFatTarget}
            workouts={data.workouts} meals={todayMeals} weights={data.weights} workoutCount={weekWorkouts}
            onAddWorkout={() => setModal('workout')} onAddMeal={() => openFoodLogger()}
            onAddWeight={() => setModal('weight')} onNavigate={changeSection}
          />}
          {section === 'Workouts' && <WorkoutsPage workouts={data.workouts} onAdd={() => setModal('workout')} />}
          {section === 'Nutrition' && <NutritionPage meals={todayMeals} calories={calories} protein={protein} carbs={carbs} fat={fat} calorieTarget={activeCalorieTarget} proteinTarget={activeProteinTarget} carbsTarget={activeCarbsTarget} fatTarget={activeFatTarget} onAdd={() => openFoodLogger()} />}
          {section === 'Progress' && <ProgressPage weights={data.weights} latestWeight={latestWeight} onAdd={() => setModal('weight')} />}
          {section === 'Intelligence' && <IntelligencePage calories={calories} protein={protein} calorieTarget={activeCalorieTarget} workoutCount={weekWorkouts} completedActions={completedActions} onToggle={toggleAction} />}
          {section === 'Meal builder' && <MealBuilder onLog={openFoodLogger} onOpenRecipe={setRecipeFood} />}
        </div>
      </main>

      {modal && modal !== 'meal' && <EntryModal type={modal} onClose={() => setModal(null)} onWorkout={(value) => { addWorkout(value); setModal(null) }} onWeight={(value) => { addWeight(value); setModal(null) }} />}
      {modal === 'meal' && <FoodQuantityModal initialFood={pendingFood} customFoods={customFoods} onClose={() => setModal(null)} onSave={(meal, customFood) => { void addMeal(meal).then((saved) => { if (saved) { if (customFood) setCustomFoods((current) => [...current.filter((food) => food.name.toLocaleLowerCase() !== customFood.name.toLocaleLowerCase()), customFood]); setModal(null); setPendingFood(null) } }) }} />}
      {recipeFood && <RecipeModal food={recipeFood} onClose={() => setRecipeFood(null)} onLog={(food) => { setRecipeFood(null); openFoodLogger(food) }} />}
      {accountModal && <AccountModal onClose={() => setAccountModal(false)} onSubmit={authenticate} />}
      {notice && <div className="toast" role="status"><span className="toast-check"><Check size={15} /></span>{notice}<button aria-label="Dismiss notification" onClick={() => setNotice('')}><X size={15} /></button></div>}
    </div>
  )
}

type DashboardProps = {
  calories: number; protein: number; carbs: number; fat: number; latestWeight: number | null; goalWeight: number | null
  calorieTarget: number | null; proteinTarget: number | null; carbsTarget: number | null; fatTarget: number | null
  workouts: Workout[]; meals: Meal[]; weights: WeightEntry[]; workoutCount: number
  onAddWorkout: () => void; onAddMeal: () => void; onAddWeight: () => void; onNavigate: (section: Section) => void
}

function Dashboard({ calories, protein, carbs, fat, latestWeight, goalWeight, calorieTarget, proteinTarget, carbsTarget, fatTarget, workouts, meals, weights, workoutCount, onAddWorkout, onAddMeal, onAddWeight, onNavigate }: DashboardProps) {
  const macroData: ChartData<'doughnut'> = {
    labels: ['Protein', 'Carbs', 'Fat'],
    datasets: [{ data: [protein, carbs, fat], backgroundColor: ['#7767f5', '#ff9d6c', '#f2ca72'], borderWidth: 0, hoverOffset: 3, borderRadius: 8, spacing: 4 }],
  }
  const macroOptions: ChartOptions<'doughnut'> = {
    cutout: '78%', plugins: { legend: { display: false }, tooltip: { enabled: true, backgroundColor: '#20212a', padding: 10, callbacks: { label: (context) => ` ${context.label}: ${context.raw}g` } } },
    maintainAspectRatio: false,
  }
  const weekDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  const isTodayWorkout = workouts[0]?.date.includes('Today') || workouts[0]?.date === 'Just now'
  const weightChange = latestWeight !== null && weights.length > 1 ? latestWeight - weights[0].value : null
  const averageWeight = weights.length ? weights.slice(-7).reduce((sum, item) => sum + item.value, 0) / weights.slice(-7).length : null
  return (
    <>
      <div className="welcome-row">
        <div><div className="eyebrow">{dateLabel()}</div><h1>Good morning, Sarthak</h1><p className="page-subtitle">A little progress each day adds up to big results.</p></div>
        <div className="date-selector"><CalendarDays size={16} /> This week <ChevronDown size={15} /></div>
      </div>

      <section className="hero-panel">
        <div className="hero-copy">
          <div className="hero-kicker"><span className="pulse-dot" /> YOUR WEEKLY RHYTHM</div>
          <h2>You’re finding<br />your <em>strong.</em></h2>
          <p>You've completed <strong>{Math.min(workoutCount, 5)} workouts</strong> this week. Keep your momentum going — consistency beats perfection.</p>
          <button className="hero-button" onClick={onAddWorkout}><Dumbbell size={16} /> {isTodayWorkout ? 'Log another workout' : 'Start a workout'} <ArrowRight size={16} /></button>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" />
          <div className="hero-ring"><div className="ring-center"><span>{Math.min(workoutCount, 5)}</span><small>of 5 sessions</small></div></div>
          <div className="hero-spark spark-a">✦</div><div className="hero-spark spark-b">✧</div>
          <div className="hero-chip"><span className="chip-indicator" /> On track</div>
        </div>
        <div className="hero-bottom"><span>WEEK OF OCT 20 — 26</span><div>{weekDays.map((day, i) => <span key={`${day}-${i}`} className={`week-day ${i < Math.min(workoutCount, 5) ? 'week-day-done' : ''}`}>{i < Math.min(workoutCount, 5) ? <Check size={12} /> : day}</span>)}</div></div>
      </section>

      <div className="section-title-row">
        <div><h2 className="section-heading">Your snapshot</h2><p className="section-caption">A quick look at how you’re doing today.</p></div>
        <button className="text-button" onClick={() => onNavigate('Progress')}>View insights <ArrowRight size={15} /></button>
      </div>

      <section className="metric-grid">
        <MetricCard icon={<Flame size={17} />} iconClass="icon-coral" label="Calories" value={calories.toLocaleString()} unit="kcal" target={calorieTarget === null ? 'no target set' : `of ${calorieTarget.toLocaleString()}`} progress={calorieTarget === null ? 0 : Math.min(calories / calorieTarget * 100, 100)} progressClass="progress-coral" detail={calorieTarget === null ? 'Set a target in your profile' : `${Math.max(calorieTarget - calories, 0).toLocaleString()} kcal remaining`} action={onAddMeal} actionLabel="Log food" />
        <MetricCard icon={<Dumbbell size={17} />} iconClass="icon-violet" label="Protein" value={protein.toString()} unit="g" target={proteinTarget === null ? 'no target set' : `of ${proteinTarget}g`} progress={proteinTarget === null ? 0 : Math.min(protein / proteinTarget * 100, 100)} progressClass="progress-violet" detail={proteinTarget === null ? 'Set a target in your profile' : `${Math.max(proteinTarget - protein, 0)}g to your goal`} action={onAddMeal} actionLabel="Add protein" />
        <MetricCard icon={<Weight size={17} />} iconClass="icon-blue" label="Body weight" value={latestWeight?.toFixed(1) ?? '—'} unit={latestWeight === null ? '' : 'kg'} target={latestWeight === null ? 'no entries yet' : goalWeight ? `${goalWeight} kg goal` : 'latest entry'} progress={latestWeight !== null && goalWeight ? Math.min(latestWeight / goalWeight * 100, 100) : 0} progressClass="progress-blue" detail={latestWeight === null ? 'Record your first weigh-in' : 'Log consistently for trends'} action={onAddWeight} actionLabel="Log weight" />
        <MetricCard icon={<HeartPulse size={17} />} iconClass="icon-green" label="Workouts" value={String(Math.min(workoutCount, 5))} unit="/ 5" target="this week" progress={Math.min(workoutCount / 5 * 100, 100)} progressClass="progress-green" detail={workoutCount >= 4 ? 'Great consistency this week' : 'You’re building a rhythm'} action={onAddWorkout} actionLabel="Start session" />
      </section>

      <div className="dashboard-columns">
        <section className="surface-card weight-card">
          <div className="card-heading-row"><div><div className="card-overline">BODY COMPOSITION</div><h3>Weight trend</h3></div><div className="select-small">7 days</div></div>
          <div className="chart-summary"><span className="large-stat">{latestWeight?.toFixed(1) ?? '—'} <small>{latestWeight === null ? '' : 'kg'}</small></span>{weightChange === null ? <span className="data-badge">More entries needed</span> : <span className="trend-tag">{weightChange <= 0 ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />} {Math.abs(weightChange).toFixed(1)} kg <span>in this view</span></span>}</div>
          <div className="weight-chart-wrap">{weights.length ? <WeightChart weights={weights} /> : <div className="chart-empty">Add a weigh-in to start your trend.</div>}</div>
          <div className="chart-footnote"><span><i className="legend-dot" /> Daily weigh-in</span><span>7-day average <strong>{averageWeight === null ? '—' : `${averageWeight.toFixed(1)} kg`}</strong></span></div>
        </section>

        <section className="surface-card nutrition-card">
          <div className="card-heading-row"><div><div className="card-overline">FUEL YOUR DAY</div><h3>Nutrition today</h3></div><button className="icon-button subtle-icon" aria-label="Nutrition options" onClick={onAddMeal}><MoreHorizontal size={20} /></button></div>
          <div className="nutrition-content">
            {meals.length ? <>
              <div className="macro-chart"><Doughnut data={macroData} options={macroOptions} /><div className="macro-center"><strong>{calories.toLocaleString()}</strong><span>{calorieTarget === null ? 'kcal logged' : `of ${calorieTarget.toLocaleString()} kcal`}</span></div></div>
              <div className="macro-legend">
                <MacroLine color="violet" name="Protein" amount={protein} goal={proteinTarget} />
                <MacroLine color="orange" name="Carbs" amount={carbs} goal={carbsTarget} />
                <MacroLine color="yellow" name="Fat" amount={fat} goal={fatTarget} />
              </div>
            </> : <div className="nutrition-empty"><Utensils size={18} /><span>Log a meal to see your nutrition breakdown.</span></div>}
          </div>
          <button className="card-bottom-link" onClick={onAddMeal}>Log a meal <Plus size={15} /></button>
        </section>
      </div>

      <div className="dashboard-columns lower-columns">
        <section className="surface-card activity-card">
          <div className="card-heading-row"><div><div className="card-overline">KEEP SHOWING UP</div><h3>Recent workouts</h3></div><button className="text-button compact" onClick={() => onNavigate('Workouts')}>View all <ArrowRight size={14} /></button></div>
          <div className="workout-list">
            {workouts.slice(0, 3).map((workout, i) => <WorkoutRow key={workout.id} workout={workout} index={i} />)}
          </div>
        </section>
        <section className="surface-card insight-card">
          <div className="card-heading-row"><div><div className="card-overline">A LITTLE MORE INSIGHT</div><h3>One thing to know</h3></div><div className="insight-icon"><Sparkles size={17} /></div></div>
          <div className="insight-body">
            <div className="insight-label">NUTRITION · GOOD MOMENTUM</div>
            <p>You’ve logged <strong>{Math.min(meals.length, 3)} meals today</strong>. A complete day of tracking helps us make more useful recommendations.</p>
            <div className="insight-source"><span className="source-check"><Check size={12} /></span>Based on your logged data<span className="source-separator">·</span><span>Today</span></div>
          </div>
          <button className="card-bottom-link" onClick={() => onNavigate('Intelligence')}>Explore your insights <ArrowRight size={15} /></button>
        </section>
      </div>

      <section className="surface-card meals-today">
        <div className="card-heading-row"><div><div className="card-overline">FUEL CHECK-IN</div><h3>Today's meals</h3></div><button className="outline-button" onClick={onAddMeal}><Plus size={15} /> Log food</button></div>
        {meals.length === 0 ? <EmptyState icon={<Utensils size={20} />} title="Nothing logged yet" text="Add your first meal to see your day take shape." action="Log a meal" onAction={onAddMeal} /> : meals.slice(-3).map((meal) => <MealRow key={meal.id} meal={meal} />)}
      </section>
      <div className="footer-note"><CircleHelp size={14} /> Estimates are for guidance only. Your progress is unique to you.</div>
    </>
  )
}

function MetricCard({ icon, iconClass, label, value, unit, target, progress, progressClass, detail, action, actionLabel }: {
  icon: ReactNode; iconClass: string; label: string; value: string; unit: string; target: string; progress: number; progressClass: string; detail: string; action: () => void; actionLabel: string
}) {
  return <article className="metric-card">
    <div className="metric-top"><div className={`metric-icon ${iconClass}`}>{icon}</div><span className="metric-label">{label}</span><button className="metric-more" aria-label={`${actionLabel} for ${label}`} onClick={action}><Plus size={15} /></button></div>
    <div className="metric-number">{value}<span>{unit}</span></div>
    <div className="metric-target">{target}</div>
    <div className="metric-progress"><span className={progressClass} style={{ width: `${progress}%` }} /></div>
    <div className="metric-foot"><span>{detail}</span><button onClick={action}>{actionLabel}</button></div>
  </article>
}

function WeightChart({ weights }: { weights: WeightEntry[] }) {
  const data: ChartData<'line'> = {
    labels: weights.slice(-7).map((entry) => entry.date),
    datasets: [{
      data: weights.slice(-7).map((entry) => entry.value), borderColor: '#7970ef', backgroundColor: (context) => {
        const chart = context.chart
        const { ctx, chartArea } = chart
        if (!chartArea) return 'rgba(121,112,239,0.12)'
        const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
        gradient.addColorStop(0, 'rgba(121,112,239,0.22)')
        gradient.addColorStop(1, 'rgba(121,112,239,0)')
        return gradient
      }, fill: true, tension: 0.42, pointRadius: 0, pointHoverRadius: 4, pointHoverBackgroundColor: '#7970ef', borderWidth: 2.5,
    }],
  }
  const options: ChartOptions<'line'> = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { displayColors: false, backgroundColor: '#20212a', padding: 10, callbacks: { label: (context) => ` ${Number(context.parsed.y ?? 0).toFixed(1)} kg` } } },
    scales: {
      x: { grid: { display: false }, border: { display: false }, ticks: { color: '#a1a2ac', font: { size: 10 }, maxRotation: 0 } },
      y: { min: Math.min(...weights.slice(-7).map((item) => item.value)) - .5, max: Math.max(...weights.slice(-7).map((item) => item.value)) + .5, grid: { color: '#f0f0f4' }, border: { display: false, dash: [4, 4] }, ticks: { color: '#a1a2ac', font: { size: 10 }, maxTicksLimit: 4, callback: (value) => `${value} kg` } },
    },
  }
  return <Line data={data} options={options} />
}

function MacroLine({ color, name, amount, goal }: { color: string; name: string; amount: number; goal: number | null }) {
  return <div className="macro-line"><div className="macro-name"><i className={`macro-dot ${color}`} />{name}<strong>{amount}g</strong></div><div className="macro-progress"><span className={`macro-bar ${color}`} style={{ width: goal === null ? '0%' : `${Math.min(amount / goal * 100, 100)}%` }} /></div><div className="macro-goal">{goal === null ? 'no target' : `${goal}g goal`}</div></div>
}

function WorkoutRow({ workout, index }: { workout: Workout; index: number }) {
  const iconClass = ['workout-purple', 'workout-peach', 'workout-blue'][index % 3]
  const Icon = [Dumbbell, Activity, Bike][index % 3]
  return <div className="workout-row"><div className={`workout-row-icon ${iconClass}`}><Icon size={17} /></div><div className="workout-row-info"><strong>{workout.title}</strong><span>{workout.focus}</span></div><div className="workout-row-meta"><span>{workout.date}</span><small><Clock3 size={12} />{workout.duration} min</small></div><ChevronRight size={16} className="row-chevron" /></div>
}

function MealRow({ meal }: { meal: Meal }) {
  const quantityLabel = meal.quantity && meal.servingUnit === 'g'
    ? `${meal.quantity} g${meal.serving?.includes('Open Food Facts') ? ' · Open Food Facts' : ''}`
    : meal.quantity && meal.serving ? `${meal.quantity} × ${meal.serving}` : meal.quantity && meal.servingUnit ? `${meal.quantity} ${meal.servingUnit}` : ''
  return <div className="meal-row"><div className="meal-row-icon"><Utensils size={16} /></div><div className="meal-row-name"><strong>{meal.name}</strong><span>{meal.type}{quantityLabel && <> <i /> {quantityLabel}</>} <i /> {meal.time}</span></div><div className="meal-row-nutrition"><strong>{meal.calories} <small>kcal</small></strong><span>{meal.protein}g protein</span></div><ChevronRight size={16} className="row-chevron" /></div>
}

function SectionHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="page-header"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p className="page-subtitle">{description}</p></div>{action}</div>
}

function WorkoutsPage({ workouts, onAdd }: { workouts: Workout[]; onAdd: () => void }) {
  const [query, setQuery] = useState('')
  const filtered = workouts.filter((workout) => workout.title.toLowerCase().includes(query.toLowerCase()) || workout.focus.toLowerCase().includes(query.toLowerCase()))
  const totalVolume = workouts.reduce((sum, workout) => sum + workout.volume, 0)
  return <>
    <SectionHeader eyebrow="TRAINING LOG" title="Workouts" description="Your training, one session at a time." action={<button className="primary-button" onClick={onAdd}><Plus size={16} /> Log workout</button>} />
    <div className="stats-strip"><MiniStat label="Sessions logged" value={String(workouts.length)} icon={<Dumbbell size={17} />} /><MiniStat label="Total volume" value={`${(totalVolume / 1000).toFixed(1)}k kg`} icon={<TrendingUp size={17} />} /><MiniStat label="This week" value={`${Math.min(workouts.length, 5)} / 5`} icon={<CalendarDays size={17} />} /></div>
    <section className="surface-card page-list-card"><div className="list-toolbar"><div><h3>Training history</h3><p>Review your recent sessions and performance.</p></div><label className="search-field"><Search size={15} /><input placeholder="Search workouts" value={query} onChange={(event) => setQuery(event.target.value)} /></label></div>
      {filtered.length === 0 ? <EmptyState icon={<Dumbbell size={20} />} title="No workouts found" text="Try another search, or log a new session." action="Log workout" onAction={onAdd} /> : filtered.map((workout, index) => <div className="workout-detail-row" key={workout.id}><WorkoutRow workout={workout} index={index} /><div className="workout-volume"><span>{workout.volume.toLocaleString()} kg</span><small>total volume</small></div></div>)}
    </section>
    <div className="helper-note"><Lightbulb size={16} /><span><strong>Progressive overload, gently.</strong> Compare similar sessions over time, not just one workout. Rest and recovery are part of your training too.</span></div>
  </>
}

function NutritionPage({ meals, calories, protein, carbs, fat, calorieTarget, proteinTarget, carbsTarget, fatTarget, onAdd }: { meals: Meal[]; calories: number; protein: number; carbs: number; fat: number; calorieTarget: number | null; proteinTarget: number | null; carbsTarget: number | null; fatTarget: number | null; onAdd: () => void }) {
  const [filter, setFilter] = useState('All meals')
  const types = ['All meals', 'Breakfast', 'Lunch', 'Dinner', 'Snack']
  const visibleMeals = meals.filter((meal) => filter === 'All meals' || meal.type.toLowerCase() === filter.toLowerCase())
  return <>
    <SectionHeader eyebrow="NUTRITION JOURNAL" title="Eat well, feel good." description="No perfect days needed. Just a little awareness." action={<button className="primary-button" onClick={onAdd}><Plus size={16} /> Log food</button>} />
    <div className="nutrition-summary-panel">
      <div className="nutrition-summary-copy"><div className="card-overline">TODAY'S INTAKE</div><strong>{calories.toLocaleString()} <span>kcal</span></strong><div className="summary-target">{calorieTarget === null ? 'No daily target set' : `of ${calorieTarget.toLocaleString()} kcal daily target`}</div><div className="big-progress"><span style={{ width: calorieTarget === null ? '0%' : `${Math.min(calories / calorieTarget * 100, 100)}%` }} /></div><span className="summary-remaining">{calorieTarget === null ? 'Set a target in your profile' : `${Math.max(calorieTarget - calories, 0)} kcal remaining`}</span></div>
      <div className="nutrition-summary-macros"><MacroTile title="Protein" current={protein} target={proteinTarget} color="violet" /><MacroTile title="Carbs" current={carbs} target={carbsTarget} color="orange" /><MacroTile title="Fat" current={fat} target={fatTarget} color="yellow" /></div>
    </div>
    <section className="surface-card page-list-card"><div className="list-toolbar"><div><h3>Food diary</h3><p>{meals.length} items logged today</p></div><div className="filter-tabs">{types.map((type) => <button key={type} className={filter === type ? 'filter-active' : ''} onClick={() => setFilter(type)}>{type}</button>)}</div></div>
      {visibleMeals.length === 0 ? <EmptyState icon={<Utensils size={20} />} title="Nothing here yet" text="Your meals will show up here when you log them." action="Add food" onAction={onAdd} /> : visibleMeals.map((meal) => <MealRow key={meal.id} meal={meal} />)}
    </section>
    <div className="helper-note"><CircleHelp size={16} /><span>Nutrition values are estimates and may vary by brand, preparation, and serving size.</span></div>
  </>
}

function MacroTile({ title, current, target, color }: { title: string; current: number; target: number | null; color: string }) {
  return <div className="macro-tile"><div className="macro-tile-top"><i className={`macro-dot ${color}`} />{title}</div><strong>{current}<small>{target === null ? 'g logged' : ` / ${target}g`}</small></strong><div className="macro-progress"><span className={`macro-bar ${color}`} style={{ width: target === null ? '0%' : `${Math.min(current / target * 100, 100)}%` }} /></div></div>
}

function ProgressPage({ weights, latestWeight, onAdd }: { weights: WeightEntry[]; latestWeight: number | null; onAdd: () => void }) {
  const start = weights[0]?.value ?? latestWeight
  const change = latestWeight !== null && start !== null ? latestWeight - start : null
  return <>
    <SectionHeader eyebrow="YOUR PROGRESS" title="Every little win counts." description="Look for the trend, not a single day." action={<button className="primary-button" onClick={onAdd}><Plus size={16} /> Record weight</button>} />
    <div className="stats-strip"><MiniStat label="Latest weigh-in" value={latestWeight === null ? '—' : `${latestWeight.toFixed(1)} kg`} icon={<Weight size={17} />} /><MiniStat label="Change in this view" value={change === null ? '—' : `${change > 0 ? '+' : ''}${change.toFixed(1)} kg`} icon={change !== null && change > 0 ? <ArrowUpRight size={17} /> : <ArrowDownRight size={17} />} /><MiniStat label="Entries recorded" value={String(weights.length)} icon={<CalendarDays size={17} />} /></div>
    <section className="surface-card progress-chart-card"><div className="card-heading-row"><div><div className="card-overline">BODYWEIGHT</div><h3>A trend, not a verdict</h3><p className="card-subtitle">Daily fluctuations are normal. The broader pattern matters more.</p></div><span className="data-badge"><span /> Based on {weights.length} entries</span></div><div className="progress-chart">{weights.length ? <WeightChart weights={weights} /> : <EmptyState icon={<Weight size={20} />} title="Your trend starts with one check-in" text="Record a bodyweight measurement to see your progress over time." action="Record weight" onAction={onAdd} />}</div><div className="chart-footnote"><span><i className="legend-dot" /> Weigh-in</span><span>Measurements are private to this device</span></div></section>
    <section className="surface-card page-list-card"><div className="list-toolbar"><div><h3>Measurement history</h3><p>Consistent timing can make comparisons more useful.</p></div></div>{weights.length ? [...weights].reverse().map((entry, index) => <div className="history-row" key={`${entry.date}-${index}`}><div className="history-icon"><Weight size={16} /></div><div><strong>{entry.date}</strong><span>Bodyweight</span></div><b>{entry.value.toFixed(1)} kg</b><span className="measured-tag">Measured</span></div>) : <EmptyState icon={<CalendarDays size={20} />} title="No measurements yet" text="Your recorded check-ins will appear here." />}</section>
  </>
}

function IntelligencePage({ calories, protein, calorieTarget, workoutCount, completedActions, onToggle }: { calories: number; protein: number; calorieTarget: number | null; workoutCount: number; completedActions: string[]; onToggle: (id: string) => void }) {
  const nutritionComplete = calorieTarget !== null && calories >= calorieTarget * .7
  const insights = [
    { id: 'logging', tag: 'DATA QUALITY', title: nutritionComplete ? 'Nice work keeping your food log going' : 'A fuller food log makes insights more useful', body: nutritionComplete ? `You have logged ${calories.toLocaleString()} kcal and ${protein}g protein so far today. Consistent tracking gives your weekly averages more context.` : calorieTarget === null ? 'You have no calorie target set yet. Logging meals still gives you a useful record, but we need a target before discussing adherence.' : `You have ${calories.toLocaleString()} kcal and ${protein}g protein logged so far. If you ate more, adding it helps keep your daily average from looking lower than it is.`, confidence: calorieTarget === null ? 'Target not set' : 'Based on today’s log', icon: <Utensils size={18} />, color: 'insight-peach' },
    { id: 'training', tag: 'TRAINING CONSISTENCY', title: workoutCount >= 3 ? 'You’re showing up consistently' : 'Your training rhythm is taking shape', body: `You have ${workoutCount} workout${workoutCount === 1 ? '' : 's'} recorded this week. Give yourself room to rest between sessions — recovery is part of progress.`, confidence: 'Based on recorded workouts', icon: <Dumbbell size={18} />, color: 'insight-violet' },
    { id: 'weight', tag: 'BODYWEIGHT TREND', title: 'More check-ins reveal a clearer pattern', body: 'Daily weight can shift with hydration, meals, and sleep. Use a few weeks of consistent measurements before making changes to your plan.', confidence: 'Trend needs more history', icon: <Weight size={18} />, color: 'insight-blue' },
  ]
  return <>
    <SectionHeader eyebrow="FITNESS INTELLIGENCE" title="Understand your patterns." description="Thoughtful nudges based on what you log — not medical advice." action={<span className="rule-engine-pill"><Sparkles size={15} /> Explainable rules</span>} />
    <div className="intelligence-banner"><div className="banner-orb"><Sparkles size={23} /></div><div><strong>Good data, better guidance.</strong><p>These insights use your activity and nutrition logs. When there isn’t enough information, we’ll say so.</p></div><div className="quality-meter"><span>DATA COVERAGE</span><strong>{Math.min(48 + workoutCount * 8 + (nutritionComplete ? 12 : 0), 88)}%</strong><div><i style={{ width: `${Math.min(48 + workoutCount * 8 + (nutritionComplete ? 12 : 0), 88)}%` }} /></div></div></div>
    <div className="section-title-row insight-title-row"><div><h2 className="section-heading">Your observations</h2><p className="section-caption">A little context for your next decision.</p></div><span className="insights-count">{insights.filter((item) => !completedActions.includes(item.id)).length} active</span></div>
    <div className="insight-list">{insights.map((insight) => {
      const done = completedActions.includes(insight.id)
      return <article className={`surface-card intelligence-item ${done ? 'intelligence-done' : ''}`} key={insight.id}><div className={`intelligence-icon ${insight.color}`}>{insight.icon}</div><div className="intelligence-content"><div className="intelligence-tag">{insight.tag}</div><h3>{insight.title}</h3><p>{insight.body}</p><span className="evidence-line"><Check size={12} />{insight.confidence}</span></div><button className={`done-button ${done ? 'done-button-active' : ''}`} onClick={() => onToggle(insight.id)}>{done ? <><Check size={14} /> Done</> : 'Mark done'}</button></article>
    })}</div>
    <div className="helper-note"><CircleHelp size={16} /><span>Insights describe patterns, not causes. Fitness estimates aren't a substitute for personalized medical advice.</span></div>
  </>
}

function MealBuilder({ onLog, onOpenRecipe }: { onLog: (food: FoodOption) => void; onOpenRecipe: (food: FoodOption) => void }) {
  const [query, setQuery] = useState('')
  const [goal, setGoal] = useState('Balanced')
  const filteredFoods = foods.filter((food) => {
    if (!food.ingredients?.length || !food.steps?.length) return false
    const matchesQuery = `${food.name} ${food.description} ${food.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase())
    const matchesGoal = goal === 'High protein' ? food.tags.includes('High protein') : goal === 'Vegetarian' ? food.tags.includes('Vegetarian') : true
    return matchesQuery && matchesGoal
  })
  return <>
    <SectionHeader eyebrow="SMART MEAL BUILDER" title="Good food, made simpler." description="Practical meal ideas using familiar, everyday ingredients." action={<span className="estimate-pill"><Sparkles size={14} /> Approximate nutrition</span>} />
    <div className="meal-builder-intro"><div className="builder-illustration"><span>🥑</span><i>✦</i><b>🥣</b></div><div><div className="card-overline">MADE FOR YOUR DAY</div><h2>What sounds good?</h2><p>Browse simple meal ideas and log one straight to your food diary. Nutrition values are estimates.</p><label className="builder-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search ingredients or meals" /></label></div></div>
    <div className="meal-builder-controls"><div><span className="control-label">I'M LOOKING FOR</span><div className="filter-tabs">{['Balanced', 'High protein', 'Vegetarian'].map((item) => <button key={item} className={goal === item ? 'filter-active' : ''} onClick={() => setGoal(item)}>{item}</button>)}</div></div>    <div className="target-budget"><Target size={16} /><span>Meal ideas around <strong>600 kcal</strong></span></div></div>
    <div className="food-grid">{filteredFoods.map((food) => <article className="surface-card food-card" key={food.name}><div className="food-art">{food.kind}<span>{food.tags[0]}</span></div><div className="food-card-copy"><div className="food-tags">{food.tags.map((tag) => <span key={tag}>{tag}</span>)}</div><h3>{food.name}</h3><p>{food.description}</p><div className="food-nutrition"><div><strong>{food.calories}</strong><span>kcal / serving</span></div><div><strong>{food.protein}g</strong><span>protein</span></div><div><strong>{food.carbs}g</strong><span>carbs</span></div><div><strong>{food.fat}g</strong><span>fat</span></div></div><div className="food-card-actions"><button className="food-recipe-button" onClick={() => onOpenRecipe(food)}>How to make <ArrowRight size={14} /></button><button className="food-log-button" onClick={() => onLog(food)}><Plus size={15} /> Log meal</button></div></div></article>)}</div>
    {filteredFoods.length === 0 && <EmptyState icon={<Search size={20} />} title="No meals match that search" text="Try a different ingredient or meal name." />}
    <div className="helper-note"><Lightbulb size={16} /><span><strong>Make it your own.</strong> Serving sizes and recipes vary. Adjust ingredient amounts to match what you actually prepare.</span></div>
  </>
}

function RecipeModal({ food, onClose, onLog }: { food: FoodOption; onClose: () => void; onLog: (food: FoodOption) => void }) {
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="entry-modal recipe-modal" role="dialog" aria-modal="true" aria-labelledby="recipe-title">
    <div className="modal-heading"><div><span className="card-overline">SIMPLE MEAL IDEA</span><h2 id="recipe-title">{food.name}</h2></div><button className="icon-button" aria-label="Close recipe" onClick={onClose}><X size={19} /></button></div>
    <p className="recipe-description">{food.description}. Recipe makes one serving; adjust ingredients to suit your appetite and preferences.</p>
    <div className="recipe-meta"><span><Clock3 size={14} /> About {food.prepMinutes ?? 15} minutes</span><span><Utensils size={14} /> 1 serving</span><span><Flame size={14} /> ~{food.calories} kcal</span></div>
    <div className="recipe-macros"><span><strong>{food.protein}g</strong> protein</span><span><strong>{food.carbs}g</strong> carbs</span><span><strong>{food.fat}g</strong> fat</span></div>
    <section className="recipe-section"><h3>Ingredients</h3><ul>{food.ingredients?.map((ingredient) => <li key={ingredient}>{ingredient}</li>)}</ul></section>
    <section className="recipe-section"><h3>How to make it</h3><ol>{food.steps?.map((step, index) => <li key={step}><span>{index + 1}</span><p>{step}</p></li>)}</ol></section>
    <p className="recipe-note">Nutrition is an estimate and will vary with ingredient brands, portions, and cooking methods.</p>
    <div className="modal-actions"><button type="button" className="cancel-button" onClick={onClose}>Close</button><button type="button" className="primary-button" onClick={() => onLog(food)}><Plus size={15} /> Log this meal</button></div>
  </section></div>
}

function MiniStat({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return <div className="mini-stat"><div className="mini-stat-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong></div></div>
}

function EmptyState({ icon, title, text, action, onAction }: { icon: ReactNode; title: string; text: string; action?: string; onAction?: () => void }) {
  return <div className="empty-state"><div className="empty-icon">{icon}</div><strong>{title}</strong><p>{text}</p>{action && onAction && <button className="text-button" onClick={onAction}>{action} <ArrowRight size={14} /></button>}</div>
}

function FoodQuantityModal({ initialFood, customFoods, onClose, onSave }: {
  initialFood: FoodOption | null
  customFoods: SavedFood[]
  onClose: () => void
  onSave: (value: Omit<Meal, 'id' | 'time'>, customFood?: SavedFood) => void
}) {
  const [foodName, setFoodName] = useState(initialFood?.name ?? '')
  const [quantity, setQuantity] = useState(1)
  const [mealType, setMealType] = useState('Snack')
  const [customName, setCustomName] = useState('')
  const [customServing, setCustomServing] = useState('1 serving')
  const [customCalories, setCustomCalories] = useState(0)
  const [customProtein, setCustomProtein] = useState(0)
  const [customCarbs, setCustomCarbs] = useState(0)
  const [customFat, setCustomFat] = useState(0)
  const [foodQuery, setFoodQuery] = useState('')
  const [searchResults, setSearchResults] = useState<FoodSearchResult[]>([])
  const [searchedFood, setSearchedFood] = useState<FoodOption | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [error, setError] = useState('')
  const savedFoodIndex = foodName.startsWith('custom-food:')
    ? Number(foodName.slice('custom-food:'.length))
    : -1
  const savedFood = Number.isInteger(savedFoodIndex) ? customFoods[savedFoodIndex] : undefined
  const selectedSavedFood: FoodOption | null = savedFood ? {
    ...savedFood, description: 'Your saved food', tags: ['My food'], kind: '🥣', servingUnit: 'serving',
  } : null
  const selectedFood = (searchedFood?.name === foodName ? searchedFood : null)
    ?? foods.find((food) => food.name === foodName)
    ?? selectedSavedFood
    ?? (initialFood?.name === foodName ? initialFood : null)
  const isCustom = foodName === 'custom'
  const baseNutrition = isCustom
    ? { calories: customCalories, protein: customProtein, carbs: customCarbs, fat: customFat }
    : selectedFood
  const safeQuantity = Number.isFinite(quantity) ? quantity : 0
  const nutritionValues = baseNutrition
    ? [baseNutrition.calories, baseNutrition.protein, baseNutrition.carbs, baseNutrition.fat]
    : []
  const validNutrition = nutritionValues.every((value) => Number.isFinite(value) && value >= 0)
  const totals = baseNutrition && validNutrition && safeQuantity > 0
    ? scaleNutrition({
      calories: baseNutrition.calories,
      protein: baseNutrition.protein,
      carbs: baseNutrition.carbs,
      fat: baseNutrition.fat,
    }, safeQuantity, selectedFood?.source ? 100 : 1)
    : null

  async function searchFoods() {
    const query = foodQuery.trim()
    if (query.length < 2) {
      setSearchError('Enter at least 2 characters to search.')
      return
    }
    setSearching(true)
    setSearchError('')
    setSearchResults([])
    try {
      const url = new URL(`${API_URL}/foods/search`)
      url.searchParams.set('q', query)
      const response = await fetch(url, { headers: { Accept: 'application/json' } })
      const payload = await response.json() as { error?: string; products?: unknown }
      if (!response.ok) throw new Error(payload.error ?? `Food search failed (HTTP ${response.status}). Try again or enter nutrition manually.`)
      if (!Array.isArray(payload.products)) throw new Error('The food database returned an unexpected response. Try again or enter nutrition manually.')
      const normalized = payload.products
        .map(normalizeOpenFoodFactsProduct)
        .filter((product): product is FoodSearchResult => product !== null)
      setSearchResults(normalized)
      if (normalized.length === 0) setSearchError('No complete nutrition records found. Try another search or enter the nutrition manually.')
    } catch (searchFailure) {
      setSearchError(searchFailure instanceof TypeError
        ? 'Could not reach the FitTrack API. Start the API or enter nutrition manually.'
        : searchFailure instanceof Error ? searchFailure.message : 'Food search is unavailable. Try again or enter nutrition manually.')
    } finally {
      setSearching(false)
    }
  }

  function selectSearchResult(result: FoodSearchResult) {
    const food: FoodOption = {
      name: result.brand ? `${result.name} (${result.brand})` : result.name,
      description: 'Open Food Facts · nutrition per 100 g',
      calories: result.calories,
      protein: result.protein,
      carbs: result.carbs,
      fat: result.fat,
      tags: ['Database result'],
      kind: '🥫',
      serving: '100 g',
      servingUnit: 'g',
      source: 'Open Food Facts',
    }
    setSearchedFood(food)
    setFoodName(food.name)
    setQuantity(100)
    setError('')
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!baseNutrition || !Number.isFinite(quantity) || quantity <= 0 || quantity > (selectedFood?.source ? 1000 : 100) ||
      [baseNutrition.calories, baseNutrition.protein, baseNutrition.carbs, baseNutrition.fat].some((value) => !Number.isFinite(value) || value < 0)) {
      setError(`Choose a food and enter a quantity greater than 0 (up to ${selectedFood?.source ? '1,000 g' : '100 servings'}).`)
      return
    }
    const name = isCustom ? customName.trim() : selectedFood?.name
    if (!name || (isCustom && !customServing.trim())) {
      setError('Enter a food name and serving description.')
      return
    }
    const serving = isCustom ? customServing.trim() : selectedFood?.source ? '100 g (Open Food Facts)' : selectedFood?.serving ?? '1 serving'
    const servingUnit = isCustom ? 'serving' : selectedFood?.servingUnit ?? 'serving'
    if (!totals) {
      setError('Enter a valid quantity to calculate nutrition.')
      return
    }
    const customFood = isCustom ? {
      name,
      serving,
      calories: customCalories,
      protein: customProtein,
      carbs: customCarbs,
      fat: customFat,
    } : undefined
    onSave({
      name, type: mealType, quantity, servingUnit, serving,
      calories: totals.calories, protein: totals.protein, carbs: totals.carbs, fat: totals.fat,
    }, customFood)
  }

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="entry-modal food-quantity-modal" role="dialog" aria-modal="true" aria-labelledby="food-modal-title"><div className="modal-heading"><div><span className="card-overline">FOOD DIARY</span><h2 id="food-modal-title">Add food & quantity</h2></div><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={19} /></button></div>
    <p className="modal-description">Choose a food, search the database, or add your own with the nutrition from its label. Your custom foods are saved on this device for next time.</p>
    <form onSubmit={handleSubmit}>
      <div className="food-search-box"><label htmlFor="food-search">Search foods</label><div className="food-search-form"><input id="food-search" autoFocus={!isCustom} value={foodQuery} onChange={(event) => setFoodQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void searchFoods() } }} placeholder="e.g. Greek yogurt, oats, apple" /><button className="food-search-button" type="button" onClick={() => void searchFoods()} disabled={searching}>{searching ? 'Searching…' : <><Search size={15} /> Search</>}</button></div><span className="food-data-credit">Search powered by <a href="https://world.openfoodfacts.org/" target="_blank" rel="noreferrer">Open Food Facts</a>. Complete products show nutrition per 100 g.</span>
        {searchError && <div className="food-search-message" role="status">{searchError}</div>}
        {searchResults.length > 0 && <div className="food-search-results" aria-label="Food search results">{searchResults.map((result, index) => <button type="button" key={`${result.id}-${index}`} onClick={() => selectSearchResult(result)}><span><strong>{result.name}</strong><small>{result.brand || 'No brand'} · per 100 g</small></span><span>{result.calories} kcal</span></button>)}</div>}
      </div>
      <label>Food<select value={foodName} onChange={(event) => { setFoodName(event.target.value); setSearchedFood(null); setQuantity(1); setError('') }}><option value="">Choose a food</option>{foods.map((food) => <option value={food.name} key={food.name}>{food.name} — {food.serving}</option>)}{customFoods.length > 0 && <optgroup label="My saved foods">{customFoods.map((food, index) => <option value={`custom-food:${index}`} key={`${food.name}-${index}`}>{food.name} — {food.serving}</option>)}</optgroup>}{selectedFood?.source && <option value={selectedFood.name}>{selectedFood.name} — per 100 g</option>}</select></label>
      <button className="custom-food-toggle" type="button" onClick={() => { setFoodName(isCustom ? '' : 'custom'); setQuantity(1); setError('') }}><Plus size={14} /> {isCustom ? 'Choose a listed food instead' : 'Add your own food'}</button>
      {isCustom && <div className="custom-food-editor"><div><strong>Enter nutrition per serving</strong><span>Use the nutrition label or your own estimate.</span></div><label>Food name<input value={customName} onChange={(event) => setCustomName(event.target.value)} placeholder="e.g. Homemade vegetable curry" /></label><label>Serving description<input value={customServing} onChange={(event) => setCustomServing(event.target.value)} placeholder="e.g. 1 bowl (250 g)" /></label><div className="form-grid custom-nutrition-fields"><label>Calories <span>kcal per serving</span><input type="number" min="0" max="10000" value={customCalories} onChange={(event) => setCustomCalories(Number(event.target.value))} /></label><label>Protein <span>g per serving</span><input type="number" min="0" max="1000" step="0.1" value={customProtein} onChange={(event) => setCustomProtein(Number(event.target.value))} /></label><label>Carbs <span>g per serving</span><input type="number" min="0" max="1000" step="0.1" value={customCarbs} onChange={(event) => setCustomCarbs(Number(event.target.value))} /></label><label>Fat <span>g per serving</span><input type="number" min="0" max="1000" step="0.1" value={customFat} onChange={(event) => setCustomFat(Number(event.target.value))} /></label></div></div>}
      {selectedFood && <div className="reference-serving"><Utensils size={14} /><span>Reference serving: <strong>{selectedFood.serving}</strong></span><span className="approximate-label">Approximate</span></div>}
      <div className="form-grid quantity-form-row"><label>Quantity <span>{selectedFood?.source ? 'grams' : 'servings'}</span><input type="number" min="0.1" max={selectedFood?.source ? '1000' : '100'} step={selectedFood?.source ? '1' : '0.1'} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /></label><label>Meal type<select value={mealType} onChange={(event) => setMealType(event.target.value)}><option>Breakfast</option><option>Lunch</option><option>Dinner</option><option>Snack</option></select></label></div>
      {totals && <div className="nutrition-calculation"><div className="calculation-heading"><span>Estimated total</span><span>{quantity} {selectedFood?.source ? 'g' : `× ${isCustom ? customServing : selectedFood?.serving}`}</span></div><div className="calculation-calories"><Flame size={16} /><strong>{totals.calories}</strong><span>kcal</span></div><div className="calculation-macros"><span><i className="macro-dot violet" />Protein <strong>{totals.protein}g</strong></span><span><i className="macro-dot orange" />Carbs <strong>{totals.carbs}g</strong></span><span><i className="macro-dot yellow" />Fat <strong>{totals.fat}g</strong></span></div></div>}
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="modal-actions"><button type="button" className="cancel-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button"><Plus size={15} /> Add to diary</button></div>
    </form>
  </section></div>
}

function EntryModal({ type, onClose, onWorkout, onWeight }: {
  type: Exclude<ModalType, 'meal' | null>; onClose: () => void;
  onWorkout: (value: Omit<Workout, 'id' | 'date' | 'complete'>) => void;
  onWeight: (value: number) => void
}) {
  const [error, setError] = useState('')
  const titles = { workout: 'Log a workout', meal: 'Log food', weight: 'Record bodyweight' }
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    if (type === 'workout') {
      const title = String(form.get('title') || '').trim()
      const volume = Number(form.get('volume'))
      const duration = Number(form.get('duration'))
      if (!title || volume < 0 || duration <= 0) { setError('Add a workout name, duration, and a valid volume.'); return }
      onWorkout({ title, focus: String(form.get('focus') || 'Full body'), duration, volume })
    } else {
      const weight = Number(form.get('weight'))
      if (!Number.isFinite(weight) || weight < 20 || weight > 350) { setError('Enter a bodyweight between 20 and 350 kg.'); return }
      onWeight(weight)
    }
  }
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="entry-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-heading"><div><span className="card-overline">YOUR PROGRESS</span><h2 id="modal-title">{titles[type]}</h2></div><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={19} /></button></div>
    <form onSubmit={handleSubmit}>
      {type === 'workout' && <><label>Workout name<input name="title" placeholder="e.g. Upper body strength" autoFocus /></label><label>Focus areas<input name="focus" placeholder="e.g. Chest · Back · Shoulders" /></label><div className="form-grid"><label>Duration <span>minutes</span><input name="duration" type="number" min="1" defaultValue="45" /></label><label>Session volume <span>kg</span><input name="volume" type="number" min="0" defaultValue="0" /></label></div></>}
      {type === 'weight' && <><p className="modal-description">Use a similar time of day for more useful comparisons. Daily weight naturally fluctuates.</p><label>Bodyweight <span>kg</span><input name="weight" type="number" min="20" max="350" step="0.1" placeholder="e.g. 72.4" autoFocus /></label></>}
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="modal-actions"><button type="button" className="cancel-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button"><Check size={15} /> Save entry</button></div>
    </form>
  </section></div>
}

function AccountModal({ onClose, onSubmit }: {
  onClose: () => void
  onSubmit: (mode: 'login' | 'register', input: { name?: string; email: string; password: string }) => void
}) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    onSubmit(mode, {
      name: String(fields.get('name') ?? '').trim() || undefined,
      email: String(fields.get('email') ?? '').trim(),
      password: String(fields.get('password') ?? ''),
    })
  }
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="entry-modal account-modal" role="dialog" aria-modal="true" aria-labelledby="account-modal-title"><div className="modal-heading"><div><span className="card-overline">YOUR FITNESS, YOUR SPACE</span><h2 id="account-modal-title">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2></div><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={19} /></button></div>
    <p className="modal-description">Connect to save your fitness records securely in your FitTrack account.</p>
    <form onSubmit={handleSubmit}>
      {mode === 'register' && <label>Your name<input name="name" placeholder="How should we greet you?" minLength={1} maxLength={80} required /></label>}
      <label>Email address<input name="email" type="email" placeholder="you@example.com" autoComplete="email" required /></label>
      <label>Password<input name="password" type="password" placeholder="At least 8 characters" minLength={8} maxLength={72} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required /></label>
      <div className="modal-actions"><button type="button" className="cancel-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button">{mode === 'login' ? 'Sign in' : 'Create account'} <ArrowRight size={15} /></button></div>
    </form>
    <div className="account-switch">{mode === 'login' ? 'New to FitTrack Pro?' : 'Already have an account?'} <button onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Create an account' : 'Sign in'}</button></div>
    <div className="account-security"><Check size={13} /> Passwords are hashed and account data is private.</div>
  </section></div>
}

export default App
