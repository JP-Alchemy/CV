import Nav from '@/components/Nav'
import Hero from '@/components/Hero'
import About from '@/components/About'
import Services from '@/components/Services'
import Building from '@/components/Building'
import Credibility from '@/components/Credibility'
import Contact from '@/components/Contact'
import Footer from '@/components/Footer'

export default function Page() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <About />
        <Services />
        <Building />
        <Credibility />
        <Contact />
      </main>
      <Footer />
    </>
  )
}
