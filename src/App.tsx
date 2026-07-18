import { StoreProvider } from './store/StoreContext'
import { Layout } from './components/Layout'

export default function App() {
  return (
    <StoreProvider>
      <Layout />
    </StoreProvider>
  )
}
