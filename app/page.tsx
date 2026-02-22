"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ThemeToggle } from "@/components/theme-toggle"
import { ArrowRight, CheckCircle, Shield, Zap, Users, FileText, Clock, TrendingUp, Lock, BarChart3, Globe, Award, Star, Play, Sparkles, Target, Rocket, Briefcase } from "lucide-react"
import { useCurrency } from "@/lib/contexts/currency-context"
import { formatCurrencyShort } from "@/lib/utils"

export default function HomePage() {
  const { currency } = useCurrency()
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/5 w-full">
      {/* Header */}
      <header className="border-b border-border/40 dark:border-border/50 bg-background/95 dark:bg-background/95 backdrop-blur-md sticky top-0 z-50 shadow-sm dark:shadow-primary/5 w-full">
        <div className="mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl w-full">
          <div className="flex items-center justify-between h-16 sm:h-20">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 group-hover:from-primary/30 group-hover:to-primary/20 transition-all duration-300 shadow-sm group-hover:scale-105">
                <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              </div>
              <span className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-foreground via-foreground to-foreground/80 bg-clip-text text-transparent">
                Legal by OdaFlow
              </span>
            </Link>
            <nav className="flex items-center gap-2 sm:gap-3">
              <Link 
                href="/pricing" 
                className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-accent/50 hidden sm:block"
              >
                Pricing
              </Link>
              <Link 
                href="#features" 
                className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-accent/50 hidden md:block"
              >
                Features
              </Link>
              <ThemeToggle />
              <Link href="/auth/demo">
                <Button variant="outline" className="hidden md:flex h-9 px-4">
                  <Zap className="mr-2 h-4 w-4" />
                  Demo
                </Button>
              </Link>
              <Link href="/auth/sign-in">
                <Button variant="ghost" className="hidden sm:flex h-9 px-4">
                  Sign In
                </Button>
              </Link>
              <Link href="/auth/sign-up">
                <Button className="h-9 px-4 sm:px-6 shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all duration-200 hover:scale-105">
                  <span className="hidden sm:inline">Start Free Trial</span>
                  <span className="sm:hidden">Trial</span>
                </Button>
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section - Split Layout */}
      <section className="relative overflow-hidden bg-gradient-to-br from-background via-background to-primary/5 dark:from-background dark:via-background dark:to-primary/10">
        {/* Decorative Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/10 dark:bg-primary/20 rounded-full blur-3xl animate-pulse-glow" />
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-primary/10 dark:bg-primary/15 rounded-full blur-3xl opacity-60 animate-float" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 dark:bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute top-20 right-20 w-32 h-32 bg-primary/20 dark:bg-primary/30 rounded-full blur-2xl animate-pulse-glow" style={{ animationDelay: '1s' }} />
        </div>

        <div className="mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 lg:py-32 relative max-w-7xl w-full">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left Side - Content */}
            <div className="space-y-8 animate-fade-in">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 backdrop-blur-sm shadow-sm">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-primary">Trusted by 500+ law firms across Africa</span>
              </div>

              {/* Headline */}
              <div className="space-y-6">
                <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold tracking-tight leading-[1.1]">
                  Manage Matters
                  <br />
                  <span className="gradient-text">Efficiently.</span>
                  <br />
                  <span className="text-foreground">Grow Your Practice.</span>
                </h1>
                
                <p className="text-lg sm:text-xl lg:text-2xl text-muted-foreground leading-relaxed max-w-2xl">
                  The all-in-one legal practice management platform that helps you streamline workflows, 
                  <span className="font-semibold text-foreground"> never miss deadlines</span>, and deliver exceptional client service.
                </p>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/auth/sign-up">
                  <Button size="lg" className="text-lg px-8 py-7 h-auto shadow-xl shadow-primary/30 hover:shadow-2xl hover:shadow-primary/40 transition-all duration-300 group hover:scale-105 w-full sm:w-auto bg-gradient-to-r from-primary to-primary/90">
                    Start Free Trial
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform duration-300" />
                  </Button>
                </Link>
                <Link href="/auth/demo">
                  <Button size="lg" variant="outline" className="text-lg px-8 py-7 h-auto w-full sm:w-auto">
                    <Zap className="mr-2 h-5 w-5" />
                    Try Demo
                  </Button>
                </Link>
                <Link href="/pricing">
                  <Button size="lg" variant="outline" className="text-lg px-8 py-7 h-auto border-2 hover:bg-accent/50 transition-all duration-300 hover:scale-105 w-full sm:w-auto">
                    <Play className="mr-2 h-5 w-5" />
                    Watch Demo
                  </Button>
                </Link>
              </div>

              {/* Trust Indicators */}
              <div className="flex flex-wrap gap-6 pt-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                  <span className="text-sm font-medium">No credit card</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                  <span className="text-sm font-medium">30-day trial</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                  <span className="text-sm font-medium">Setup in 5 minutes</span>
                </div>
              </div>
            </div>

            {/* Right Side - Visual Dashboard Mockup */}
            <div className="relative lg:block hidden">
              <div className="relative animate-fade-in" style={{ animationDelay: '0.2s' }}>
                {/* Dashboard Card */}
                <div className="bg-card/80 dark:bg-card/90 border-2 border-border/50 dark:border-border/60 rounded-3xl shadow-2xl dark:shadow-primary/10 p-6 backdrop-blur-md bg-gradient-to-br from-card via-card/95 to-card/50 dark:from-card dark:via-card/90 dark:to-card/70">
                  {/* Dashboard Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Briefcase className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="font-semibold text-sm">Active Matters</div>
                        <div className="text-xs text-muted-foreground">24 this month</div>
                      </div>
                    </div>
                    <div className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                      +12%
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="p-4 rounded-xl bg-muted/60 dark:bg-muted/40 border border-border/50 dark:border-border/60 hover:bg-muted/80 dark:hover:bg-muted/60 transition-colors group">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
                        <span className="text-xs text-muted-foreground font-medium">Due Today</span>
                      </div>
                      <div className="text-2xl font-bold text-foreground">8</div>
                    </div>
                    <div className="p-4 rounded-xl bg-muted/60 dark:bg-muted/40 border border-border/50 dark:border-border/60 hover:bg-muted/80 dark:hover:bg-muted/60 transition-colors group">
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
                        <span className="text-xs text-muted-foreground font-medium">Clients</span>
                      </div>
                      <div className="text-2xl font-bold text-foreground">142</div>
                    </div>
                    <div className="p-4 rounded-xl bg-muted/60 dark:bg-muted/40 border border-border/50 dark:border-border/60 hover:bg-muted/80 dark:hover:bg-muted/60 transition-colors group">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
                        <span className="text-xs text-muted-foreground font-medium">Documents</span>
                      </div>
                      <div className="text-2xl font-bold text-foreground">1.2K</div>
                    </div>
                    <div className="p-4 rounded-xl bg-muted/60 dark:bg-muted/40 border border-border/50 dark:border-border/60 hover:bg-muted/80 dark:hover:bg-muted/60 transition-colors group">
                      <div className="flex items-center gap-2 mb-2">
                        <BarChart3 className="h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
                        <span className="text-xs text-muted-foreground font-medium">Revenue</span>
                      </div>
                      <div className="text-2xl font-bold text-foreground">{formatCurrencyShort(2400000, currency)}</div>
                    </div>
                  </div>

                  {/* Recent Activity */}
                  <div className="space-y-3">
                    <div className="text-sm font-semibold mb-3">Recent Activity</div>
                    {[
                      { icon: CheckCircle, text: "Contract signed - Acme Corp", time: "2h ago", color: "text-green-600" },
                      { icon: Clock, text: "Deadline reminder - Case #1245", time: "4h ago", color: "text-orange-600" },
                      { icon: FileText, text: "Document uploaded - KYC Form", time: "6h ago", color: "text-blue-600" },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 dark:bg-muted/30 border border-border/30 dark:border-border/40 hover:bg-muted/60 dark:hover:bg-muted/50 hover:border-primary/20 transition-all group">
                        <item.icon className={`h-4 w-4 ${item.color} group-hover:scale-110 transition-transform`} />
                        <div className="flex-1">
                          <div className="text-sm font-medium text-foreground">{item.text}</div>
                          <div className="text-xs text-muted-foreground">{item.time}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Floating Elements */}
                <div className="absolute -top-4 -right-4 w-16 h-16 bg-primary/20 dark:bg-primary/30 rounded-2xl flex items-center justify-center shadow-xl dark:shadow-primary/20 animate-float border border-primary/20 dark:border-primary/30">
                  <Target className="h-8 w-8 text-primary" />
                </div>
                <div className="absolute -bottom-4 -left-4 w-20 h-20 bg-primary/15 dark:bg-primary/25 rounded-2xl flex items-center justify-center shadow-xl dark:shadow-primary/20 animate-pulse-glow border border-primary/20 dark:border-primary/30">
                  <Rocket className="h-10 w-10 text-primary" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="border-t border-border/40 dark:border-border/50 bg-gradient-to-r from-muted/40 via-muted/30 to-muted/40 dark:from-muted/20 dark:via-muted/15 dark:to-muted/20 backdrop-blur-sm w-full">
          <div className="mx-auto px-4 sm:px-6 lg:px-8 py-10 max-w-7xl w-full">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              <div className="text-center group">
                <div className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-2 group-hover:scale-110 transition-transform">500+</div>
                <div className="text-sm text-muted-foreground font-medium">Law Firms</div>
              </div>
              <div className="text-center group">
                <div className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-2 group-hover:scale-110 transition-transform">50K+</div>
                <div className="text-sm text-muted-foreground font-medium">Matters Managed</div>
              </div>
              <div className="text-center group">
                <div className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-2 group-hover:scale-110 transition-transform">99.9%</div>
                <div className="text-sm text-muted-foreground font-medium">Uptime SLA</div>
              </div>
              <div className="text-center group">
                <div className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-2 flex items-center justify-center gap-2 group-hover:scale-110 transition-transform">
                  4.9
                  <Star className="h-6 w-6 fill-primary text-primary" />
                </div>
                <div className="text-sm text-muted-foreground font-medium">Average Rating</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 lg:py-32 scroll-mt-20 max-w-7xl w-full">
        <div className="text-center mb-16 sm:mb-20">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <Zap className="h-4 w-4" />
            Powerful Features
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold mb-6">
            Everything You Need to
            <br />
            <span className="gradient-text">Run Your Practice</span>
          </h2>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto">
            Built specifically for modern law firms. No compromises, no workarounds.
          </p>
        </div>
        
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 mb-16">
          <Card className="group hover:shadow-2xl hover:shadow-primary/10 transition-all duration-500 border-2 hover:border-primary/30 hover:-translate-y-2 bg-gradient-to-br from-card to-card/50 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardHeader className="pb-4 relative z-10">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mb-4 group-hover:from-primary/30 group-hover:to-primary/20 transition-all duration-300 group-hover:scale-110 shadow-lg">
                <Clock className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-xl sm:text-2xl mb-3">Never Miss Deadlines</CardTitle>
              <CardDescription className="text-sm sm:text-base leading-relaxed">
                Automated deadline tracking with intelligent alerts and escalation workflows. Your team stays on track, your clients stay happy.
              </CardDescription>
            </CardHeader>
          </Card>
          
          <Card className="group hover:shadow-2xl hover:shadow-primary/10 transition-all duration-500 border-2 hover:border-primary/30 hover:-translate-y-2 bg-gradient-to-br from-card to-card/50 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardHeader className="pb-4 relative z-10">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mb-4 group-hover:from-primary/30 group-hover:to-primary/20 transition-all duration-300 group-hover:scale-110 shadow-lg">
                <Users className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-xl sm:text-2xl mb-3">Client-First Design</CardTitle>
              <CardDescription className="text-sm sm:text-base leading-relaxed">
                Everything revolves around your clients. One unified command center for all client information, matters, documents, and communications.
              </CardDescription>
            </CardHeader>
          </Card>
          
          <Card className="group hover:shadow-2xl hover:shadow-primary/10 transition-all duration-500 border-2 hover:border-primary/30 hover:-translate-y-2 bg-gradient-to-br from-card to-card/50 relative overflow-hidden sm:col-span-2 lg:col-span-1">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardHeader className="pb-4 relative z-10">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mb-4 group-hover:from-primary/30 group-hover:to-primary/20 transition-all duration-300 group-hover:scale-110 shadow-lg">
                <Zap className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-xl sm:text-2xl mb-3">Smart Work Queues</CardTitle>
              <CardDescription className="text-sm sm:text-base leading-relaxed">
                Stop hunting for work. AI-powered queues surface what needs attention, when it needs attention. Work smarter, not harder.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* More Features Grid */}
        <div className="grid sm:grid-cols-2 gap-6 lg:gap-8">
          <Card className="p-8 hover:shadow-xl hover:shadow-primary/5 transition-all duration-500 border-2 hover:border-primary/30 hover:-translate-y-1 group">
            <div className="flex items-start gap-5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center flex-shrink-0 group-hover:from-primary/30 group-hover:to-primary/20 transition-all duration-300 group-hover:scale-110 shadow-md">
                <FileText className="h-7 w-7 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-xl sm:text-2xl mb-3">Matter Management</h3>
                <p className="text-muted-foreground leading-relaxed text-sm sm:text-base">
                  Complete intake workflows, automated conflict checking, visual stage pipelines, and intelligent matter templates.
                </p>
              </div>
            </div>
          </Card>
          
          <Card className="p-8 hover:shadow-xl hover:shadow-primary/5 transition-all duration-500 border-2 hover:border-primary/30 hover:-translate-y-1 group">
            <div className="flex items-start gap-5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center flex-shrink-0 group-hover:from-primary/30 group-hover:to-primary/20 transition-all duration-300 group-hover:scale-110 shadow-md">
                <Shield className="h-7 w-7 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-xl sm:text-2xl mb-3">KYC & Compliance</h3>
                <p className="text-muted-foreground leading-relaxed text-sm sm:text-base">
                  Automated KYC checklists that adapt by client and matter type, document tracking with expiry alerts.
                </p>
              </div>
            </div>
          </Card>
          
          <Card className="p-8 hover:shadow-xl hover:shadow-primary/5 transition-all duration-500 border-2 hover:border-primary/30 hover:-translate-y-1 group">
            <div className="flex items-start gap-5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center flex-shrink-0 group-hover:from-primary/30 group-hover:to-primary/20 transition-all duration-300 group-hover:scale-110 shadow-md">
                <BarChart3 className="h-7 w-7 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-xl sm:text-2xl mb-3">Trust Accounting</h3>
                <p className="text-muted-foreground leading-relaxed text-sm sm:text-base">
                  Built-in trust account management with multi-level approval workflows and real-time balance tracking.
                </p>
              </div>
            </div>
          </Card>
          
          <Card className="p-8 hover:shadow-xl hover:shadow-primary/5 transition-all duration-500 border-2 hover:border-primary/30 hover:-translate-y-1 group">
            <div className="flex items-start gap-5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center flex-shrink-0 group-hover:from-primary/30 group-hover:to-primary/20 transition-all duration-300 group-hover:scale-110 shadow-md">
                <Lock className="h-7 w-7 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-xl sm:text-2xl mb-3">Client Portal</h3>
                <p className="text-muted-foreground leading-relaxed text-sm sm:text-base">
                  Beautiful, secure portal where clients can view matters, upload documents, pay invoices, and communicate.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Social Proof */}
      <section className="bg-gradient-to-b from-muted/30 to-background py-20 sm:py-28 lg:py-32 w-full">
        <div className="mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl w-full">
          <div className="max-w-4xl mx-auto text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
              <Award className="h-4 w-4" />
              Trusted by Industry Leaders
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold mb-6">
              Join Firms That
              <br />
              <span className="gradient-text">Choose Excellence</span>
            </h2>
          </div>
          
          {/* Testimonial Cards */}
          <div className="grid md:grid-cols-3 gap-6 lg:gap-8 mb-16">
            <Card className="p-6 border-2 hover:border-primary/30 transition-all duration-300">
              <div className="flex items-center gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-5 w-5 fill-primary text-primary" />
                ))}
              </div>
              <p className="text-muted-foreground mb-4 leading-relaxed">
                "Legal by OdaFlow transformed how we manage our practice. Deadlines are never missed, and our team productivity increased by 40%."
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="font-semibold">Sarah Johnson</div>
                  <div className="text-sm text-muted-foreground">Managing Partner</div>
                </div>
              </div>
            </Card>
            
            <Card className="p-6 border-2 hover:border-primary/30 transition-all duration-300">
              <div className="flex items-center gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-5 w-5 fill-primary text-primary" />
                ))}
              </div>
              <p className="text-muted-foreground mb-4 leading-relaxed">
                "The client portal alone has improved our client satisfaction scores. Everything is in one place, and clients love the transparency."
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="font-semibold">Michael Chen</div>
                  <div className="text-sm text-muted-foreground">Senior Partner</div>
                </div>
              </div>
            </Card>
            
            <Card className="p-6 border-2 hover:border-primary/30 transition-all duration-300">
              <div className="flex items-center gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-5 w-5 fill-primary text-primary" />
                ))}
              </div>
              <p className="text-muted-foreground mb-4 leading-relaxed">
                "Best investment we've made. The automation features save us hours every week, and the trust accounting is flawless."
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="font-semibold">Emily Rodriguez</div>
                  <div className="text-sm text-muted-foreground">Firm Administrator</div>
                </div>
              </div>
            </Card>
          </div>

          {/* Trust Badges */}
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-8 lg:gap-12 opacity-60">
            <div className="flex items-center gap-2 whitespace-nowrap">
              <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-primary flex-shrink-0" />
              <span className="text-xs sm:text-sm font-medium">SOC 2 Certified</span>
            </div>
            <div className="flex items-center gap-2 whitespace-nowrap">
              <Lock className="h-5 w-5 sm:h-6 sm:w-6 text-primary flex-shrink-0" />
              <span className="text-xs sm:text-sm font-medium">Bank-Level Security</span>
            </div>
            <div className="flex items-center gap-2 whitespace-nowrap">
              <Globe className="h-5 w-5 sm:h-6 sm:w-6 text-primary flex-shrink-0" />
              <span className="text-xs sm:text-sm font-medium">99.9% Uptime SLA</span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 lg:py-32 max-w-7xl w-full">
        <Card className="max-w-5xl mx-auto border-2 bg-gradient-to-br from-card via-card/95 to-card/90 overflow-hidden relative shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10" />
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl opacity-50" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl opacity-50" />
          <CardHeader className="text-center relative z-10 pb-6 pt-12 sm:pt-16 px-6 sm:px-8">
            <CardTitle className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold mb-6">
              Ready to Transform
              <br />
              <span className="gradient-text">Your Practice?</span>
            </CardTitle>
            <CardDescription className="text-lg sm:text-xl lg:text-2xl max-w-3xl mx-auto">
              Join forward-thinking law firms using Legal by OdaFlow to deliver exceptional client service and grow their practice.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center relative z-10 pb-12 sm:pb-16 px-6 sm:px-8">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
              <Link href="/auth/sign-up">
                <Button size="lg" className="text-lg px-12 py-8 h-auto shadow-xl shadow-primary/30 hover:shadow-2xl hover:shadow-primary/40 transition-all duration-300 group hover:scale-105 w-full sm:w-auto bg-gradient-to-r from-primary to-primary/90">
                  Start Your Free Trial
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform duration-300" />
                </Button>
              </Link>
              <Link href="/pricing">
                <Button size="lg" variant="outline" className="text-lg px-12 py-8 h-auto border-2 hover:bg-accent/50 transition-all duration-300 hover:scale-105 w-full sm:w-auto">
                  View Pricing Plans
                </Button>
              </Link>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 lg:gap-6 text-xs sm:text-sm text-muted-foreground">
              <div className="flex items-center gap-2 whitespace-nowrap">
                <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-2 whitespace-nowrap">
                <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                <span>30-day free trial</span>
              </div>
              <div className="flex items-center gap-2 whitespace-nowrap">
                <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                <span>Cancel anytime</span>
              </div>
              <div className="flex items-center gap-2 whitespace-nowrap">
                <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                <span>Setup in minutes</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-muted/20 py-12 sm:py-16 w-full">
        <div className="mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl w-full">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
            <div>
              <Link href="/" className="flex items-center gap-2 group mb-4">
                <div className="p-1.5 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <span className="font-bold text-lg">Legal by OdaFlow</span>
              </Link>
              <p className="text-sm text-muted-foreground">
                The modern legal practice management platform trusted by leading law firms.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="#features" className="hover:text-foreground transition-colors">Features</Link></li>
                <li><Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link></li>
                <li><Link href="/auth/sign-up" className="hover:text-foreground transition-colors">Free Trial</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="#" className="hover:text-foreground transition-colors">About</Link></li>
                <li><Link href="#" className="hover:text-foreground transition-colors">Blog</Link></li>
                <li><Link href="#" className="hover:text-foreground transition-colors">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="#" className="hover:text-foreground transition-colors">Privacy</Link></li>
                <li><Link href="#" className="hover:text-foreground transition-colors">Terms</Link></li>
                <li><Link href="#" className="hover:text-foreground transition-colors">Security</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border/40 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground text-center sm:text-left">
              © 2024 Legal by OdaFlow. All rights reserved.
            </p>
            <div className="flex items-center gap-4">
              <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Pricing
              </Link>
              <Link href="/auth/sign-in" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
