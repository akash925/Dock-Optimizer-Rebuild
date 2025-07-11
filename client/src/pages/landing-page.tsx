import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { 
  TruckIcon, 
  ClockIcon, 
  BarChart3Icon, 
  CheckCircleIcon, 
  ArrowRightIcon,
  CalendarIcon,
  BellIcon,
  FileTextIcon,
  MonitorIcon,
  BuildingIcon,
  UserCheckIcon,
  StarIcon,
  PlayCircleIcon
} from "lucide-react";
import dockOptimizerLogo from "@/assets/dock_optimizer_logo.jpg";

const stats = [
  { number: "1M+", label: "Loads Scheduled", description: "across all warehouses" },
  { number: "50+", label: "Warehouses", description: "streamlining operations" },
  { number: "20%", label: "Average Savings", description: "on shipping & receiving" },
  { number: "100%", label: "Satisfaction", description: "trusted by operators" }
];

const benefits = [
  {
    icon: TruckIcon,
    title: "Enhanced Efficiency",
    description: "Dispatchers and drivers can start using Dock Optimizer immediately without the need for account creation or complex onboarding processes, making implementation quick and hassle-free."
  },
  {
    icon: MonitorIcon,
    title: "Improved Operational Visibility",
    description: "Gain comprehensive insights with a centralized dashboard and detailed analytics, allowing for better decision-making and live tracking of appointments."
  },
  {
    icon: ClockIcon,
    title: "Increased Flexibility",
    description: "Adapt to changes seamlessly with customizable scheduling and easy handling of reschedules and cancellations, suited for both single and multi-location operations."
  }
];

const features = [
  {
    icon: CalendarIcon,
    title: "Appointment Scheduling",
    description: "Easily schedule, reschedule, and manage appointments to ensure efficient dock usage and minimize conflicts."
  },
  {
    icon: BellIcon,
    title: "Automated Notifications",
    description: "Keep your team, drivers, and dispatchers informed with real-time alerts and updates on appointment changes."
  },
  {
    icon: FileTextIcon,
    title: "Comprehensive Reporting",
    description: "Access detailed reports and analytics to gain insights into your scheduling performance and make data-driven decisions."
  },
  {
    icon: ClockIcon,
    title: "Real-Time Updates",
    description: "Monitor and manage appointments in real-time, ensuring up-to-date information for all stakeholders."
  },
  {
    icon: BuildingIcon,
    title: "Multi-Location Management",
    description: "Seamlessly handle scheduling across multiple warehouse locations from a single, centralized platform."
  },
  {
    icon: UserCheckIcon,
    title: "User-Friendly Dashboard",
    description: "Enjoy an intuitive and easy-to-navigate dashboard that simplifies the scheduling process for all users."
  }
];

const testimonials = [
  {
    quote: "Dock Optimizer has revolutionized our scheduling process. We've significantly reduced appointment conflicts and streamlined our operations. The intuitive interface made it easy for our team to adapt quickly.",
    author: "Austin Hildebrandt",
    company: "Stephen Gould Indianapolis",
    logo: null
  },
  {
    quote: "The ability to customize schedules and handle changes effortlessly with Dock Optimizer has made a significant impact on our operations. Previously, managing schedule adjustments and last-minute changes was a cumbersome task, but Dock Optimizer's flexibility has streamlined this process. We can now tailor schedules to fit our specific needs and adapt quickly to any unforeseen changes without disrupting our workflow. This level of control and ease has greatly improved our operational efficiency. Dock Optimizer has truly become a valuable asset in our daily operations, providing us with the tools we need to manage our warehouse scheduling more effectively and efficiently.",
    author: "Seth Colson",
    company: "Director of IT, Hanzo Logistics",
    logo: "/src/assets/hanzo_logo.jpeg"
  },
  {
    quote: "The ability to customize schedules and handle changes effortlessly with Dock Optimizer has made a significant impact on our operations. Previously, managing schedule adjustments and last-minute changes was a cumbersome task, but Dock Optimizer's flexibility has streamlined this process. We can now tailor schedules to fit our specific needs and adapt quickly to any unforeseen changes without disrupting our workflow. This level of control and ease has greatly improved our operational efficiency. Dock Optimizer has truly become a valuable asset in our daily operations, providing us with the tools we need to manage our warehouse scheduling more effectively and efficiently.",
    author: "Alexa Jacobs",
    company: "Warehouse Manager, MGD Logistics",
    logo: null
  },
  {
    quote: "Dock Optimizer has truly revolutionized our scheduling process. We've significantly reduced appointment conflicts and streamlined our operations. The intuitive interface made it easy for our team to adapt quickly.",
    author: "Jared Palmer",
    company: "CSO, Backhaul Direct",
    logo: null
  }
];

const whyChooseReasons = [
  {
    icon: TruckIcon,
    title: "Effortless Setup",
    description: "Dispatchers and drivers can start using Dock Optimizer immediately without the need for account creation or complex onboarding processes, making implementation quick and hassle-free."
  },
  {
    icon: UserCheckIcon,
    title: "Intuitive Interface",
    description: "Our easy-to-use dashboard simplifies the scheduling process, allowing users to make adjustments and manage appointments with minimal training."
  },
  {
    icon: BellIcon,
    title: "Automated Notifications",
    description: "Receive real-time alerts for scheduling changes, appointment confirmations, and updates to ensure that everyone stays informed and operations run smoothly."
  }
];

export default function LandingPage() {
  const [, navigate] = useLocation();

  const handleSignUp = () => {
    navigate("/auth");
  };

  const handleLogin = () => {
    navigate("/auth");
  };

  const handleBookDemo = () => {
    // For now, navigate to auth page, but this could be a demo booking form
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header - Enhanced with better styling */}
      <header className="bg-white/95 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center">
              <img 
                src={dockOptimizerLogo} 
                alt="Dock Optimizer" 
                className="h-12 w-auto"
              />
              <span className="ml-3 text-2xl font-bold text-gray-900">Dock Optimizer</span>
            </div>
            <nav className="hidden md:flex space-x-8">
              <a href="#why-dock-optimizer" className="text-gray-600 hover:text-blue-600 px-3 py-2 text-sm font-semibold transition-colors">Why Dock Optimizer</a>
              <a href="#benefits" className="text-gray-600 hover:text-blue-600 px-3 py-2 text-sm font-semibold transition-colors">Our Benefits</a>
              <a href="#features" className="text-gray-600 hover:text-blue-600 px-3 py-2 text-sm font-semibold transition-colors">Features</a>
              <a href="#testimonials" className="text-gray-600 hover:text-blue-600 px-3 py-2 text-sm font-semibold transition-colors">Testimonials</a>
            </nav>
            <div className="flex items-center space-x-4">
              <Button variant="ghost" onClick={handleLogin} className="font-semibold">
                Login
              </Button>
              <Button onClick={handleSignUp} className="bg-blue-600 hover:bg-blue-700 font-semibold shadow-lg">
                Sign Up
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section - Enhanced with better design */}
      <section className="relative bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 text-white overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.05%22%3E%3Ccircle%20cx%3D%2230%22%20cy%3D%2230%22%20r%3D%222%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-40"></div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
          <div className="text-center">
            <div className="mb-8">
              <Badge className="bg-blue-500/20 text-blue-100 border-blue-400/30 mb-6">
                Trusted by 50+ Warehouses
              </Badge>
            </div>
            <h1 className="text-5xl md:text-7xl font-extrabold mb-8 tracking-tight">
              Effortless <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-white">Scheduling</span> for
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-300 to-blue-200">Superior</span> Supply Chain Management
            </h1>
            <p className="text-xl md:text-2xl mb-12 max-w-4xl mx-auto text-blue-100 leading-relaxed">
              Take control of your warehouse schedule and streamline your dock scheduling with Dock Optimizer.
            </p>
            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
              <Button 
                size="lg" 
                className="bg-white text-blue-600 hover:bg-blue-50 font-bold text-lg px-8 py-4 rounded-xl shadow-2xl transform hover:scale-105 transition-all"
                onClick={handleBookDemo}
              >
                <PlayCircleIcon className="mr-3 h-6 w-6" />
                Book a Demo
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="border-2 border-white text-white hover:bg-white hover:text-blue-600 font-bold text-lg px-8 py-4 rounded-xl backdrop-blur-sm transform hover:scale-105 transition-all"
                onClick={handleSignUp}
              >
                Get Started Free
                <ArrowRightIcon className="ml-3 h-6 w-6" />
              </Button>
            </div>
            
            {/* Trust indicators */}
            <div className="mt-16 flex flex-col items-center">
              <p className="text-blue-200 text-sm mb-4">Trusted by industry leaders</p>
              <div className="flex items-center space-x-8 opacity-70">
                <span className="text-2xl font-bold">1M+</span>
                <span className="text-sm">Loads Scheduled</span>
                <span className="text-2xl font-bold">50+</span>
                <span className="text-sm">Warehouses</span>
                <span className="text-2xl font-bold">20%</span>
                <span className="text-sm">Average Savings</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-gray-600 mb-8">Over 6 years of providing innovative solutions to streamline warehouse operations.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-4xl font-bold text-blue-600 mb-2">{stat.number}</div>
                <div className="text-xl font-semibold text-gray-800 mb-1">{stat.label}</div>
                <div className="text-gray-600">{stat.description}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose Section */}
      <section id="why-dock-optimizer" className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <Badge className="mb-4">Why Choose Our Tool</Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Why Dock Optimizer Stands Out
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Discover the advantages of Dock Optimizer and see how our innovative solution can transform your warehouse operations.
            </p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {whyChooseReasons.map((reason, index) => (
              <Card key={index} className="border-0 shadow-lg">
                <CardHeader>
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                    <reason.icon className="h-6 w-6 text-blue-600" />
                  </div>
                  <CardTitle className="text-xl">{reason.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">{reason.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="benefits" className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <Badge className="mb-4">Our Benefits</Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Why You'll Love Our Tool
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
              Discover the key benefits of using Dock Optimizer and how it can revolutionize your dock scheduling and operations.
            </p>
            <Button onClick={handleBookDemo} size="lg">
              <PlayCircleIcon className="mr-2 h-5 w-5" />
              Book a Demo
            </Button>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-12">
            {benefits.map((benefit, index) => (
              <Card key={index} className="border-0 shadow-lg">
                <CardHeader>
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
                    <benefit.icon className="h-6 w-6 text-green-600" />
                  </div>
                  <CardTitle className="text-xl">{benefit.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">{benefit.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <Badge className="mb-4">Our Testimonials</Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              See what Our Clients Are Saying
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
              Hear directly from our satisfied customers about how Dock Optimizer has transformed their warehouse operations and enhanced their scheduling efficiency.
            </p>
            <Button onClick={handleBookDemo} size="lg">
              <PlayCircleIcon className="mr-2 h-5 w-5" />
              Book a Demo
            </Button>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-12">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="border-0 shadow-lg">
                <CardContent className="p-8">
                  <div className="flex mb-4">
                    {[...Array(5)].map((_, i) => (
                      <StarIcon key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                    ))}
                  </div>
                  <p className="text-gray-700 mb-6 italic">"{testimonial.quote}"</p>
                  <div className="flex items-center">
                    {testimonial.logo && (
                      <img 
                        src={testimonial.logo} 
                        alt={testimonial.company}
                        className="w-10 h-10 rounded-full mr-4"
                      />
                    )}
                    <div>
                      <div className="font-semibold text-gray-900">{testimonial.author}</div>
                      <div className="text-gray-600 text-sm">{testimonial.company}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <Badge className="mb-4">Why Choose Our Tool</Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Powerful Features to Enhance Your Operations
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Unlock the full potential of your warehouse operations with Dock Optimizer's powerful and user-friendly features designed to streamline your scheduling process.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="border-0 shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader>
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-purple-600" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-r from-blue-600 to-blue-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Transform your warehouse operations with Dock Optimizer
          </h2>
          <p className="text-xl mb-8 max-w-3xl mx-auto">
            Discover the key benefits of using Dock Optimizer and how it can revolutionize your dock scheduling and operations.
          </p>
          <Button 
            size="lg" 
            className="bg-white text-blue-600 hover:bg-gray-100"
            onClick={handleBookDemo}
          >
            <PlayCircleIcon className="mr-2 h-5 w-5" />
            Book a Demo
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="col-span-1 md:col-span-2">
              <img 
                src={dockOptimizerLogo} 
                alt="Dock Optimizer" 
                className="h-10 w-auto mb-4"
              />
              <p className="text-gray-400 mb-4">
                Effortless scheduling for superior supply chain management. Take control of your warehouse schedule and streamline your dock scheduling with Dock Optimizer.
              </p>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-4">Product</h3>
              <ul className="space-y-2">
                <li><Button variant="link" className="text-gray-400 hover:text-white p-0 h-auto" onClick={handleBookDemo}>Book a Demo</Button></li>
                <li><a href="#why-dock-optimizer" className="text-gray-400 hover:text-white">Why Dock Optimizer</a></li>
                <li><a href="#benefits" className="text-gray-400 hover:text-white">Our Benefits</a></li>
                <li><a href="#features" className="text-gray-400 hover:text-white">Features</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-4">Company</h3>
              <ul className="space-y-2">
                <li><a href="https://conmitto.io" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white">About</a></li>
                <li><a href="https://conmitto.io/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white">Privacy Policy</a></li>
                <li><a href="https://conmitto.io/terms-of-service" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white">Terms of Service</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 text-sm">
              © 2025 <a href="https://conmitto.io" target="_blank" rel="noopener noreferrer" className="hover:text-white">Conmitto Inc</a>. All rights reserved.
            </p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleLogin}
                className="text-gray-400 hover:text-white"
              >
                Login
              </Button>
              <Button 
                size="sm" 
                onClick={handleSignUp}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Sign Up
              </Button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
} 