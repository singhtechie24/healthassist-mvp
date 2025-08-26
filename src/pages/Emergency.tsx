import { useState, useEffect, useRef } from 'react';
import GoogleMapComponent from '../components/GoogleMap';
import ToastService from '../services/toastService';

interface EmergencyScenario {
  id: string;
  title: string;
  description: string;
  symptoms: string[];
  steps: string[];
  callScript: string;
  urgencyLevel: 'high' | 'medium' | 'low';
}

interface LocationData {
  latitude: number;
  longitude: number;
  address: string;
  city: string;
  state: string;
}

interface Hospital {
  name: string;
  address: string;
  distance: number;
  phone: string;
  type: 'General' | 'Trauma' | 'Specialty';
  lat: number;
  lng: number;
}

interface EmergencyContact {
  name: string;
  phone: string;
  relationship: string;
}

// Real London hospitals data with coordinates (Phase 2 - Enhanced)
const londonHospitals: Hospital[] = [
  {
    name: "St Thomas' Hospital",
    address: "Westminster Bridge Rd, Lambeth, London SE1 7EH",
    distance: 2.1,
    phone: "+44 20 7188 7188",
    type: "Trauma",
    lat: 51.4989,
    lng: -0.1195
  },
  {
    name: "Guy's Hospital",
    address: "Great Maze Pond, London SE1 9RT",
    distance: 2.8,
    phone: "+44 20 7188 7188",
    type: "General",
    lat: 51.5043,
    lng: -0.0871
  },
  {
    name: "King's College Hospital",
    address: "Denmark Hill, London SE5 9RS",
    distance: 4.2,
    phone: "+44 20 3299 9000",
    type: "Trauma",
    lat: 51.4681,
    lng: -0.0926
  },
  {
    name: "London Bridge Hospital",
    address: "27 Tooley St, London SE1 2PR",
    distance: 3.1,
    phone: "+44 20 7407 3100",
    type: "General",
    lat: 51.5045,
    lng: -0.0865
  },
  {
    name: "Royal London Hospital",
    address: "Whitechapel Rd, Whitechapel, London E1 1FR",
    distance: 5.8,
    phone: "+44 20 7377 7000",
    type: "Trauma",
    lat: 51.5174,
    lng: -0.0590
  }
];

const emergencyScenarios: EmergencyScenario[] = [
  {
    id: 'heart-attack',
    title: 'Heart Attack',
    description: 'Chest pain and breathing difficulty',
    symptoms: ['Chest pain or pressure', 'Shortness of breath', 'Nausea', 'Sweating', 'Dizziness'],
    steps: [
      'Call 911 immediately',
      'Chew aspirin if available and not allergic',
      'Sit down and rest',
      'Loosen tight clothing',
      'Stay calm and wait for help'
    ],
    callScript: "911, I need an ambulance. I think someone is having a heart attack. Address: [YOUR ADDRESS]. The person has chest pain and difficulty breathing. They are [AGE] years old and [CONSCIOUS/UNCONSCIOUS].",
    urgencyLevel: 'high'
  },
  {
    id: 'stroke',
    title: 'Stroke',
    description: 'FAST symptoms - Face, Arms, Speech, Time',
    symptoms: ['Face drooping', 'Arm weakness', 'Speech difficulty', 'Sudden confusion', 'Severe headache'],
    steps: [
      'Call 911 immediately',
      'Note the time symptoms started',
      'Keep person comfortable',
      'Do not give food or water',
      'Stay with the person'
    ],
    callScript: "911, I need an ambulance for a possible stroke. Address: [YOUR ADDRESS]. The person shows signs of stroke - face drooping, arm weakness, or speech problems. Symptoms started at [TIME].",
    urgencyLevel: 'high'
  },
  {
    id: 'choking',
    title: 'Choking',
    description: 'Person cannot breathe or speak',
    symptoms: ['Cannot speak or cough', 'Clutching throat', 'Blue lips/face', 'Panic expression'],
    steps: [
      'Ask "Are you choking?"',
      'If they cannot speak, call 911',
      'Perform Heimlich maneuver',
      'Continue until object dislodged or person unconscious',
      'If unconscious, start CPR'
    ],
    callScript: "911, I need an ambulance. Someone is choking and cannot breathe. Address: [YOUR ADDRESS]. I am performing the Heimlich maneuver.",
    urgencyLevel: 'high'
  }
];

export default function Emergency() {
  const [selectedScenario, setSelectedScenario] = useState<EmergencyScenario | null>(null);
  const [isPracticing, setIsPracticing] = useState(false);
  const [practiceStep, setPracticeStep] = useState(0);
  
  // Location & ETA states
  const [location, setLocation] = useState<LocationData | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [manualLocationMode, setManualLocationMode] = useState(false);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const addressInputRef = useRef<HTMLInputElement | null>(null);
  const [ambulanceETA, setAmbulanceETA] = useState<number | null>(null);
  const [isEmergencyActive, setIsEmergencyActive] = useState(false);

  
  // Smart Ambulance Simulation states
  const [emergencyCountdown, setEmergencyCountdown] = useState<number | null>(null);

  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(null);
  const [primaryAmbulance, setPrimaryAmbulance] = useState<{id: string; hospital: string; eta: number; status: string} | null>(null);
  const [backupAmbulance, setBackupAmbulance] = useState<{id: string; hospital: string; eta: number; status: string} | null>(null);

  const [ambulanceDelay, setAmbulanceDelay] = useState<number>(0);
  const [isRerouting, setIsRerouting] = useState<boolean>(false);
  const [emergencyLog, setEmergencyLog] = useState<string[]>([]);

  // Step 4: Simulation Statistics Tracking
  const [simulationStats, setSimulationStats] = useState<{
    startTime: Date | null;
    endTime: Date | null;
    totalDuration: number; // in seconds
    originalETA: number; // in minutes
    finalETA: number; // in minutes
    trafficDelays: number; // in minutes
    reroutingCount: number;
    hospitalName: string;
    ambulanceId: string;
    timeSaved: number; // calculated time saved vs regular 911
  }>({
    startTime: null,
    endTime: null,
    totalDuration: 0,
    originalETA: 0,
    finalETA: 0,
    trafficDelays: 0,
    reroutingCount: 0,
    hospitalName: '',
    ambulanceId: '',
    timeSaved: 0
  });

  // Live hospital data from Google Places API
  const [liveHospitals, setLiveHospitals] = useState<Hospital[]>([]);
  const [hospitalsLoading, setHospitalsLoading] = useState(false);
  
  // Sample emergency contacts (in real app, stored in user profile)
  const [emergencyContacts] = useState<EmergencyContact[]>([
    { name: "Emergency Contact 1", phone: "+1-555-0001", relationship: "Family" },
    { name: "Emergency Contact 2", phone: "+1-555-0002", relationship: "Friend" },
  ]);

  // Traffic and routing states
  const [currentRoute, setCurrentRoute] = useState<google.maps.DirectionsResult | null>(null);
  const [realTimeETA, setRealTimeETA] = useState<number | null>(null);
  const [trafficLevel, setTrafficLevel] = useState<'light' | 'moderate' | 'heavy'>('light');
  
  // Ambulance tracking states
  const [ambulanceProgress, setAmbulanceProgress] = useState<number>(0); // 0-100%
  const [isTrackingAmbulance, setIsTrackingAmbulance] = useState<boolean>(false);
  const [ambulanceTrackingInterval, setAmbulanceTrackingInterval] = useState<NodeJS.Timeout | null>(null);
  
  // Demo Mode for faster testing (Step 5: Speed Enhancement)
  const [demoMode, setDemoMode] = useState<boolean>(true); // Default to fast for better UX
  const speedMultiplier = demoMode ? 5 : 1; // 5x faster in demo mode (10min → 2min)
  
  // Emergency simulation states - CLEAN REWRITE
  const [isEmergencyInProgress, setIsEmergencyInProgress] = useState<boolean>(false);
  const [currentPhase, setCurrentPhase] = useState<'idle' | 'countdown' | 'calling' | 'dispatch' | 'tracking' | 'complete'>('idle');
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const dispatchedRef = useRef<boolean>(false); // Prevent duplicate dispatches

  // Location functions
  const requestLocation = async () => {
    setLocationLoading(true);
    setLocationError(null);
    
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by this browser");
      setLocationLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        // Simulate reverse geocoding (in real app, use Google Maps API)
        const mockAddress = {
          latitude,
          longitude,
          address: "123 Main Street",
          city: "London",
          state: "England"
        };
        
        setLocation(mockAddress);
        setLocationLoading(false);
        setHospitalsLoading(true); // Start loading hospitals when location is available
        localStorage.removeItem('locationPermission'); // Clear any previous denial
      },
      (error) => {
        let errorMessage = "Location access denied";
        switch(error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "Location access denied by user";
            localStorage.setItem('locationPermission', 'denied');
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Location information unavailable";
            break;
          case error.TIMEOUT:
            errorMessage = "Location request timed out";
            break;
          default:
            errorMessage = "Unknown location error";
            break;
        }
        setLocationError(errorMessage);
        setLocationLoading(false);
        
        // Provide fallback location for demo purposes
        setManualLocationMode(true);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  // Geocode address to get real coordinates
  const geocodeAddress = async (fullAddress: string): Promise<{lat: number, lng: number} | null> => {
    try {
      const geocoder = new google.maps.Geocoder();
      
      return new Promise((resolve) => {
        geocoder.geocode({ address: fullAddress }, (results, status) => {
          if (status === 'OK' && results && results[0]) {
            const location = results[0].geometry.location;
            console.log('🗺️ Geocoded address:', fullAddress, '→', location.lat(), location.lng());
            resolve({
              lat: location.lat(),
              lng: location.lng()
            });
          } else {
            console.error('❌ Geocoding failed:', status);
            resolve(null);
          }
        });
      });
    } catch (error) {
      console.error('❌ Geocoding error:', error);
      return null;
    }
  };

  // Initialize Google Places Autocomplete
  const initializeAutocomplete = () => {
    if (!addressInputRef.current || autocompleteRef.current) return;
    
    try {
      console.log('🔍 Initializing Google Places Autocomplete...');
      
      autocompleteRef.current = new google.maps.places.Autocomplete(addressInputRef.current, {
        types: ['address'], // Focus on addresses
        fields: ['formatted_address', 'geometry', 'address_components'],
        componentRestrictions: { country: ['gb', 'us', 'ca', 'au'] } // Major English-speaking countries
      });

      // Listen for place selection
      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current?.getPlace();
        if (place && place.geometry && place.formatted_address) {
          console.log('📍 Autocomplete place selected:', place.formatted_address);
          
          // Extract address components
          const addressComponents = place.address_components || [];
          let streetAddress = '';
          let city = '';
          let state = '';
          
          addressComponents.forEach(component => {
            const types = component.types;
            if (types.includes('street_number') || types.includes('route')) {
              streetAddress += component.long_name + ' ';
            } else if (types.includes('locality') || types.includes('postal_town')) {
              city = component.long_name;
            } else if (types.includes('administrative_area_level_1')) {
              state = component.long_name;
            }
          });
          
          // Use coordinates directly from autocomplete result
          const coordinates = {
            lat: place.geometry.location!.lat(),
            lng: place.geometry.location!.lng()
          };
          
          setManualLocationWithCoordinates(
            streetAddress.trim() || place.formatted_address,
            city || 'Unknown City',
            state || 'Unknown State',
            coordinates
          );
        }
      });
      
      console.log('✅ Autocomplete initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize autocomplete:', error);
    }
  };

  // Set manual location with pre-calculated coordinates
  const setManualLocationWithCoordinates = (address: string, city: string, state: string, coordinates?: {lat: number, lng: number}) => {
    try {
      const manualLocation = {
        latitude: coordinates?.lat || 51.5074, // Fallback to London
        longitude: coordinates?.lng || -0.1278,
        address,
        city,
        state
      };
      
      console.log('📍 Setting manual location with coordinates:', manualLocation);
      setLocation(manualLocation);
      setManualLocationMode(false);
      setLocationError(null);
      setHospitalsLoading(true); // Start loading hospitals for manual location
      
      console.log('✅ Manual location set - hospitals will load for new location');
    } catch (error) {
      console.error('❌ Manual location error:', error);
      setLocationError('Failed to set location. Please try again.');
    }
  };

  const setManualLocation = async (address: string, city: string, state: string) => {
    try {
      setLocationLoading(true);
      const fullAddress = `${address}, ${city}, ${state}`;
      console.log('🔍 Geocoding address:', fullAddress);
      
      // Try to get real coordinates from address
      const coordinates = await geocodeAddress(fullAddress);
      
      const manualLocation = {
        latitude: coordinates?.lat || 51.5074, // Fallback to London if geocoding fails
        longitude: coordinates?.lng || -0.1278,
        address,
        city,
        state
      };
      
      console.log('📍 Setting manual location:', manualLocation);
      setLocation(manualLocation);
      setManualLocationMode(false);
      setLocationError(null);
      setLocationLoading(false);
      setHospitalsLoading(true); // Start loading hospitals for manual location
      
      // Reset hospital loading state to allow fresh loading
      if (coordinates) {
        console.log('✅ Real coordinates found - hospitals will load for new location');
      } else {
        console.log('⚠️ Using fallback coordinates - geocoding failed');
      }
      
    } catch (error) {
      console.error('❌ Manual location error:', error);
      setLocationError('Failed to set location. Please try again.');
      setLocationLoading(false);
    }
  };

  // Traffic and route calculation functions
  const calculateRouteWithTraffic = async (hospital: Hospital, userLocation: LocationData) => {
    if (!window.google?.maps?.DirectionsService) {
      console.log('🚨 Directions API not available, using fallback simulation');
      return simulateTrafficRoute(hospital);
    }

    try {
      console.log('🗺️ Calculating real route with traffic...');
      const directionsService = new google.maps.DirectionsService();
      
      const request: google.maps.DirectionsRequest = {
        origin: { lat: hospital.lat, lng: hospital.lng },
        destination: { lat: userLocation.latitude, lng: userLocation.longitude },
        travelMode: google.maps.TravelMode.DRIVING,
        drivingOptions: {
          departureTime: new Date(),
          trafficModel: google.maps.TrafficModel.BEST_GUESS
        },
        avoidHighways: false,
        avoidTolls: false
      };

      const result = await new Promise<google.maps.DirectionsResult>((resolve, reject) => {
        directionsService.route(request, (result, status) => {
          if (status === google.maps.DirectionsStatus.OK && result) {
            resolve(result);
          } else {
            reject(new Error(`Directions request failed: ${status}`));
          }
        });
      });

      setCurrentRoute(result);
      
      // Extract duration with traffic
      const leg = result.routes[0]?.legs[0];
      if (leg?.duration_in_traffic?.value) {
        const etaMinutes = Math.ceil(leg.duration_in_traffic.value / 60);
        setRealTimeETA(etaMinutes);
        console.log('🚑 Real ETA with traffic:', etaMinutes, 'minutes');
        return etaMinutes;
      } else if (leg?.duration?.value) {
        const etaMinutes = Math.ceil(leg.duration.value / 60);
        setRealTimeETA(etaMinutes);
        console.log('🚑 Real ETA without traffic:', etaMinutes, 'minutes');
        return etaMinutes;
      }
      
      throw new Error('No duration data in route response');
      
    } catch (error) {
      console.error('🚨 Route calculation failed:', error);
      return simulateTrafficRoute(hospital);
    }
  };

  const simulateTrafficRoute = (hospital: Hospital) => {
    console.log('🎭 Simulating traffic route...');
    
    // Calculate base ETA from distance
    const distance = hospital.distance || 5; // km
    const baseETA = Math.ceil(distance / 0.5); // ~30 km/h in city traffic
    
    // Apply traffic multiplier
    const trafficMultiplier = {
      light: 1.0,
      moderate: 1.3,
      heavy: 1.8
    }[trafficLevel];
    
    const etaWithTraffic = Math.ceil(baseETA * trafficMultiplier);
    setRealTimeETA(etaWithTraffic);
    console.log(`🚑 Simulated ETA: ${etaWithTraffic}min (${distance}km, ${trafficLevel} traffic)`);
    
    return etaWithTraffic;
  };

  // 🚨 CLEAN EMERGENCY DISPATCH LOGIC - SINGLE FLOW
  const startEmergencySequence = (urgencyLevel: 'high' | 'medium' | 'low') => {
    // BULLETPROOF: Prevent multiple calls
    if (isEmergencyInProgress || dispatchedRef.current) {
      console.log('⚠️ Emergency already in progress - ignoring duplicate');
      return;
    }

    console.log('🚨 Starting emergency sequence:', urgencyLevel);
    setIsEmergencyInProgress(true);
    dispatchedRef.current = true;
    setCurrentPhase('countdown');
    setEmergencyLog(['🚨 Emergency button pressed - 10 seconds to cancel']);
    setEmergencyCountdown(10);

    // Step 4: Start tracking simulation statistics
    setSimulationStats(prev => ({
      ...prev,
      startTime: new Date(),
      endTime: null,
      reroutingCount: 0,
      trafficDelays: 0
    }));

    // Clear any existing countdown
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
    }

    // Start 10-second countdown
    let count = 10;
    countdownRef.current = setInterval(() => {
      count--;
      setEmergencyCountdown(count);
      
      if (count <= 0) {
        clearInterval(countdownRef.current!);
        countdownRef.current = null;
        proceedWithDispatch(urgencyLevel);
      }
    }, 1000);
  };

  const proceedWithDispatch = (urgencyLevel: 'high' | 'medium' | 'low') => {
    setCurrentPhase('calling');
    
    // Select hospital
    const hospitalList = liveHospitals.length > 0 ? liveHospitals : londonHospitals;
    const hospital = hospitalList[0]; // Use nearest hospital
    
    if (!hospital) {
      setEmergencyLog(prev => [...prev, '❌ No hospitals available']);
      resetEmergency();
      return;
    }

    setSelectedHospital(hospital);
    setEmergencyLog(prev => [...prev, `📞 Calling ${hospital.name}...`]);

    // Simulate call (3-5 seconds)
    const callDelay = Math.random() * 2000 + 3000;
    
    setTimeout(() => {
      simulateHospitalResponse(hospital, urgencyLevel);
    }, callDelay);
  };

  const simulateHospitalResponse = (hospital: Hospital, urgencyLevel: 'high' | 'medium' | 'low') => {
    // 70% chance hospital answers
    const hospitalAnswers = Math.random() < 0.7;
    console.log('🎲 Hospital call outcome:', hospitalAnswers ? 'ANSWERED' : 'NO ANSWER');
    
    if (hospitalAnswers) {
      setEmergencyLog(prev => [...prev, '📞 Hospital answered - explaining emergency...']);
      
      // User explains situation (2 seconds)
      setTimeout(() => {
        setEmergencyLog(prev => [...prev, '🗣️ Explaining emergency situation...']);
        
        // Hospital makes decision (3 seconds)
        setTimeout(() => {
          const dispatchChances = { high: 0.9, medium: 0.8, low: 0.7 };
          const hospitalApproves = Math.random() < dispatchChances[urgencyLevel];
          
          if (hospitalApproves) {
            setEmergencyLog(prev => [...prev, '✅ Hospital confirmed - dispatching ambulance']);
          } else {
            setEmergencyLog(prev => [...prev, '⚠️ Hospital busy - auto-dispatching nearest ambulance']);
          }
          
          setTimeout(() => startAmbulanceDispatch(hospital), 1000 / speedMultiplier);
        }, 3000 / speedMultiplier);
      }, 2000 / speedMultiplier);
    } else {
      setEmergencyLog(prev => [...prev, '📞 No response from hospital - auto-dispatching ambulance']);
      setTimeout(() => startAmbulanceDispatch(hospital), 2000 / speedMultiplier);
    }
  };

  const startAmbulanceDispatch = (hospital: Hospital) => {
    setCurrentPhase('dispatch');
    setIsEmergencyActive(true); // Enable route display on map
    
    // Create ambulance
    const ambulance = {
      id: 'AMB-001',
      hospital: hospital.name,
      eta: Math.floor(Math.random() * 10) + 5, // 5-15 minutes
      status: 'dispatched'
    };
    setPrimaryAmbulance(ambulance);
    setAmbulanceETA(ambulance.eta);

    // Step 4: Track ambulance and hospital details
    setSimulationStats(prev => ({
      ...prev,
      originalETA: ambulance.eta,
      finalETA: ambulance.eta,
      hospitalName: hospital.name,
      ambulanceId: ambulance.id
    }));
    
    // Calculate route for map tracking if location is available
    if (location) {
      calculateRouteWithTraffic(hospital, location).then(realETA => {
        if (realETA) {
          setAmbulanceETA(realETA);
          console.log('🚑 Updated ETA with real traffic data:', realETA);
        }
      }).catch(error => {
        console.log('🎭 Using simulated ETA due to routing error:', error.message);
      });
    }
    
    setEmergencyLog(prev => [
      ...prev,
      `🚑 Ambulance ${ambulance.id} dispatched`,
      `⏱️ Estimated arrival: ${ambulance.eta} minutes`,
      '📍 Ambulance en route - starting tracking...'
    ]);

    setTimeout(() => startAmbulanceTracking(), 2000 / speedMultiplier);
  };

  const resetEmergency = () => {
    console.log('🔄 Resetting emergency state');
    
    // Clear all timers
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    if (ambulanceTrackingInterval) {
      clearInterval(ambulanceTrackingInterval);
      setAmbulanceTrackingInterval(null);
    }
    
    // Reset all states
    setIsEmergencyInProgress(false);
    setCurrentPhase('idle');
    setIsEmergencyActive(false);
    setEmergencyCountdown(null);
    setSelectedHospital(null);
    setPrimaryAmbulance(null);
    setBackupAmbulance(null);
    setAmbulanceETA(null);
    setAmbulanceProgress(0);
    setIsTrackingAmbulance(false);
    setIsRerouting(false);
    setEmergencyLog([]);
    
    // Reset dispatch flag
    dispatchedRef.current = false;
  };

  const cancelEmergency = () => {
    setEmergencyLog(prev => [...prev, '✅ Emergency cancelled by user']);
    setTimeout(() => resetEmergency(), 1000);
  };

  // Clean cancel countdown function
  const cancelCountdown = () => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setEmergencyCountdown(null);
    setCurrentPhase('idle');
    setEmergencyLog(prev => [...prev, '✅ Emergency cancelled by user']);
    setTimeout(() => resetEmergency(), 1000);
  };



  const startAmbulanceTracking = () => {
    // Prevent multiple calls
    if (isTrackingAmbulance) {
      console.log('⚠️ Ambulance tracking already in progress, ignoring duplicate call');
      return;
    }
    
    // Clear any existing tracking interval
    if (ambulanceTrackingInterval) {
      console.log('🧹 Clearing existing tracking interval');
      clearInterval(ambulanceTrackingInterval);
      setAmbulanceTrackingInterval(null);
    }
    
    console.log('🚑 Starting ambulance tracking...');
    setCurrentPhase('tracking');
    setIsTrackingAmbulance(true);
    setAmbulanceProgress(0);
    
    setEmergencyLog(prev => [
      ...prev, 
      '🚑 Starting real-time ambulance tracking...'
    ]);
    
    // Start new route-based ambulance tracking
    if (!currentRoute) {
      console.log('⚠️ No route available for ambulance tracking - starting basic tracking');
    }
    
    // Calculate total journey time for progress calculation
    const totalETA = realTimeETA || ambulanceETA || 10; // fallback to 10 minutes
    const progressIncrement = (100 / (totalETA * 60)) * speedMultiplier; // progress per second with demo speed
    
    // Create a unique interval ID for this tracking session
    const trackingId = Date.now();
    console.log(`🚀 Starting tracking session: ${trackingId}`);
    
    const interval = setInterval(() => {
      setAmbulanceProgress(prev => {
        const newProgress = prev + progressIncrement;
        
        if (newProgress >= 100) {
          // Ambulance has arrived
          console.log(`🏁 Tracking session ${trackingId} completed`);
          clearInterval(interval);
          setIsTrackingAmbulance(false);
          setAmbulanceTrackingInterval(null);
          setAmbulanceProgress(100);
          setEmergencyLog(prevLog => [...prevLog, '🎯 Ambulance has arrived at your location!']);
          // Complete simulation after a short delay
          setTimeout(() => completeSimulation(), 2000 / speedMultiplier);
          return 100;
        }
        
        // Log progress milestones (prevent duplicates with unique timestamp)
        const currentMilestone = Math.floor(prev / 25);
        const newMilestone = Math.floor(newProgress / 25);
        
        if (newMilestone > currentMilestone && newMilestone <= 3) { // Only log 25%, 50%, 75%
          const milestone = newMilestone * 25;
          console.log(`📊 [${trackingId}] Milestone ${milestone}%: ${prev.toFixed(1)}% → ${newProgress.toFixed(1)}%`);
          
          // Use functional update to prevent race conditions
          setEmergencyLog(prevLog => {
            const lastEntry = prevLog[prevLog.length - 1];
            const milestoneMessage = `🚑 Ambulance ${milestone}% of the way to you`;
            
            // Prevent duplicate if last message is the same
            if (lastEntry !== milestoneMessage) {
              console.log(`✅ [${trackingId}] Adding milestone: ${milestoneMessage}`);
              return [...prevLog, milestoneMessage];
            } else {
              console.log(`⚠️ [${trackingId}] Duplicate milestone prevented: ${milestoneMessage}`);
              return prevLog;
            }
          });
        }
        
        return newProgress;
      });
    }, 1000 / speedMultiplier); // Update interval adjusted for demo speed
    
    setAmbulanceTrackingInterval(interval);
    
    // Simulate traffic conditions after 5-8 seconds
    const trafficDelay = (Math.random() * 3000 + 5000) / speedMultiplier; // 5-8 seconds adjusted for demo speed
    setTimeout(() => {
      simulateTrafficConditions();
    }, trafficDelay);
  };



  const simulateTrafficConditions = () => {
    const conditions = ['light', 'moderate', 'heavy'] as const;
    const randomCondition = conditions[Math.floor(Math.random() * conditions.length)];
    setTrafficLevel(randomCondition);
    
    if (randomCondition === 'heavy') {
      const delay = Math.floor(Math.random() * 8) + 5; // 5-12 minutes delay
      setAmbulanceDelay(delay);
      
      // Step 4: Track traffic delays
      setSimulationStats(prev => ({
        ...prev,
        trafficDelays: prev.trafficDelays + delay,
        finalETA: prev.finalETA + delay
      }));
      
      setEmergencyLog(prev => [
        ...prev,
        '🚦 Heavy traffic detected!',
        `⚠️ Ambulance delayed by ${delay} minutes`
      ]);
      
      // Trigger AI rerouting after 2 seconds
      setTimeout(() => {
        triggerAIRerouting();
      }, 2000 / speedMultiplier);
    } else if (randomCondition === 'moderate') {
      const delay = Math.floor(Math.random() * 4) + 2; // 2-5 minutes delay
      setAmbulanceDelay(delay);
      setEmergencyLog(prev => [
        ...prev,
        '🚦 Moderate traffic detected',
        `⏳ Slight delay: +${delay} minutes`
      ]);
      
      // 50% chance to trigger AI analysis even for moderate traffic (for demo)
      if (Math.random() < 0.5) {
        setTimeout(() => {
          triggerAIRerouting();
        }, 3000 / speedMultiplier);
      }
    } else {
      setEmergencyLog(prev => [...prev, '✅ Clear roads - ambulance on schedule']);
    }
  };

  const triggerAIRerouting = () => {
    setCurrentPhase('tracking'); // Keep in tracking phase during rerouting
    setIsRerouting(true);
    
    // Step 4: Track rerouting attempt
    setSimulationStats(prev => ({
      ...prev,
      reroutingCount: prev.reroutingCount + 1
    }));
    
    setEmergencyLog(prev => [
      ...prev,
      '🤖 AI analyzing alternative options...',
      '📊 Checking nearby hospitals for faster ambulances'
    ]);
    
    // Simulate AI analysis for 3 seconds
    setTimeout(() => {
      executeAIRerouting();
    }, 3000);
  };

  const executeAIRerouting = () => {
    // Find alternative hospital (use live data if available)
    const hospitalList = liveHospitals.length > 0 ? liveHospitals : londonHospitals;
    const alternativeHospitals = hospitalList.filter(h => h.name !== selectedHospital?.name);
    const backupHospital = alternativeHospitals[Math.floor(Math.random() * alternativeHospitals.length)];
    
    // Calculate new ETA
    const newETA = Math.floor(Math.random() * 5) + 4; // 4-8 minutes
    const currentETA = (ambulanceETA || 0) + ambulanceDelay;
    
    if (newETA < currentETA) {
      // Execute rerouting
      const newAmbulance = {
        id: `AMB-${Math.floor(Math.random() * 900) + 100}`,
        hospital: backupHospital.name,
        eta: newETA,
        status: 'dispatched'
      };
      
      setBackupAmbulance(newAmbulance);
      setAmbulanceETA(newETA);
      
      setEmergencyLog(prev => [
        ...prev,
        `✅ Found faster option!`,
        `🚑 ${newAmbulance.id} from ${backupHospital.name}`,
        `⚡ New ETA: ${newETA} minutes (${currentETA - newETA} min faster)`,
        `📞 Cancelling ${primaryAmbulance?.id}`,
        `🎯 Resources optimized successfully!`
      ]);
      
      // Completion will be handled by ambulance progress tracking
    } else {
      setEmergencyLog(prev => [
        ...prev,
        '❌ No faster alternatives found',
        '📍 Continuing with original ambulance'
      ]);
      
      // Completion will be handled by ambulance progress tracking
    }
  };

  const completeSimulation = () => {
    setCurrentPhase('complete');
    const finalAmbulance = backupAmbulance || primaryAmbulance;
    const endTime = new Date();
    
    // Step 4: Complete simulation statistics
    setSimulationStats(prev => {
      const totalDuration = prev.startTime ? Math.floor((endTime.getTime() - prev.startTime.getTime()) / 1000) : 0;
      const currentETA = ambulanceETA || prev.finalETA;
      
      // Calculate time saved vs typical 911 response (assume 15-20 minutes average)
      const typical911Response = 18; // minutes
      const timeSaved = Math.max(0, typical911Response - currentETA);
      
      return {
        ...prev,
        endTime,
        totalDuration,
        finalETA: currentETA,
        trafficDelays: ambulanceDelay,
        timeSaved
      };
    });
    
    setEmergencyLog(prev => [
      ...prev,
      `🏁 Simulation complete!`,
      `🚑 ${finalAmbulance?.id || 'AMB-001'} arrived successfully`,
      `💡 Thank you for using HealthAssist Emergency Simulator`
    ]);
    
    // Don't auto-reset - let user manually reset to view summary properly
  };

  // Practice functions
  const startPractice = (scenario: EmergencyScenario) => {
    setSelectedScenario(scenario);
    setIsPracticing(true);
    setPracticeStep(0);
  };

  const nextStep = () => {
    if (selectedScenario && practiceStep < selectedScenario.steps.length - 1) {
      setPracticeStep(practiceStep + 1);
    }
  };

  const resetPractice = () => {
    setIsPracticing(false);
    setSelectedScenario(null);
    setPracticeStep(0);
  };

  // Auto-request location on component mount (only if not previously denied)
  useEffect(() => {
    // Check if user has previously denied location
    const hasLocationPermission = localStorage.getItem('locationPermission');
    if (hasLocationPermission !== 'denied') {
      requestLocation();
    } else {
      setLocationError('Location access previously denied');
      setManualLocationMode(true);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 dark:from-gray-900 dark:via-gray-900 dark:to-red-950">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-red-500 to-orange-600 rounded-full mb-6 shadow-lg animate-pulse">
            <span className="text-3xl">🚨</span>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent mb-4">
            Emergency Resources
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Practice emergency scenarios, learn life-saving skills, and experience AI-powered emergency response
          </p>
          
          {/* Emergency Disclaimer */}
          <div className="mt-8 bg-red-50/80 dark:bg-red-900/30 backdrop-blur-lg border border-red-200 dark:border-red-700 rounded-3xl p-6 shadow-xl max-w-4xl mx-auto">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-800/50 rounded-full flex items-center justify-center">
                <span className="text-red-600 dark:text-red-400 text-xl">⚠️</span>
              </div>
              <div className="flex-1 text-left">
                <h3 className="text-lg font-bold text-red-800 dark:text-red-300 mb-2">Important Safety Notice</h3>
                <p className="text-red-700 dark:text-red-300 text-sm leading-relaxed">
                  <strong>This is for practice and education only.</strong> In a real emergency, call 911 immediately. 
                  These simulations do not replace professional medical training or actual emergency services.
                </p>
              </div>
            </div>
          </div>
        </div>

      {!isPracticing ? (
        <>
          {/* Smart Ambulance Simulation Dashboard */}
          {(emergencyCountdown !== null || isEmergencyInProgress) && (
            <div className="mb-8 bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border border-red-200 dark:border-red-700 rounded-3xl shadow-2xl p-8 transition-all duration-300 hover:shadow-3xl">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <span className="text-xl">🚑</span>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
                      Smart Ambulance Dispatch
                    </h2>
                    <p className="text-red-700">AI-powered emergency response simulation</p>
                  </div>
                </div>
                <button
                  onClick={cancelEmergency}
                  className="w-10 h-10 bg-red-100 text-red-600 rounded-xl hover:bg-red-200 hover:scale-110 transition-all duration-300 flex items-center justify-center shadow-md"
                  title="Stop simulation"
                >
                  ✕
                </button>
              </div>

              {/* Emergency Countdown */}
              {emergencyCountdown !== null && currentPhase === 'countdown' && (
                <div className="text-center mb-8">
                  <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-8 border border-red-200 shadow-lg">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-red-500 to-orange-600 rounded-full mb-4 shadow-lg">
                      <span className="text-2xl">⏰</span>
                    </div>
                    <h3 className="text-2xl font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent mb-4">
                      Emergency Activation
                    </h3>
                    <div className="text-8xl font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent mb-4 animate-pulse">
                      {emergencyCountdown}
                    </div>
                    <p className="text-red-700 text-lg font-medium mb-6">Seconds until ambulance dispatch</p>
                    <button
                      onClick={cancelCountdown}
                      className="bg-gradient-to-r from-gray-600 to-gray-700 text-white px-8 py-4 rounded-2xl text-lg font-semibold hover:from-gray-700 hover:to-gray-800 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-gray-300/30"
                    >
                      ❌ Cancel Emergency
                    </button>
                  </div>
                </div>
              )}

              {/* Emergency Status Dashboard */}
              {isEmergencyInProgress && currentPhase !== 'countdown' && (
                <div className="space-y-6">
                  {/* Current Status */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 border border-red-200 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                      <div className="flex items-center mb-4">
                        <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md mr-3">
                          <span className="text-xl">🚑</span>
                        </div>
                        <h3 className="text-lg font-bold text-red-900">Current Ambulance</h3>
                      </div>
                      {backupAmbulance ? (
                        <div>
                          <p className="text-lg font-bold text-green-700">{backupAmbulance.id}</p>
                          <p className="text-sm text-gray-600">{backupAmbulance.hospital}</p>
                          <p className="text-xs text-green-600">🔄 Rerouted ambulance</p>
                        </div>
                      ) : primaryAmbulance ? (
                        <div>
                          <p className="text-lg font-bold text-blue-700">{primaryAmbulance.id}</p>
                          <p className="text-sm text-gray-600">{primaryAmbulance.hospital}</p>
                          <p className="text-xs text-blue-600">📍 Original dispatch</p>
                        </div>
                      ) : currentPhase === 'calling' ? (
                        <div>
                          <p className="text-lg font-bold text-orange-600">📞 Calling hospital...</p>
                          <p className="text-xs text-orange-500">🎭 Simulating emergency call</p>
                        </div>
                      ) : currentPhase === 'dispatch' ? (
                        <div>
                          <p className="text-lg font-bold text-blue-600">🚑 Dispatching ambulance...</p>
                          <p className="text-xs text-blue-500">⚡ Setting up emergency response</p>
                        </div>
                      ) : (
                        <p className="text-gray-500">Dispatching...</p>
                      )}
                    </div>

                    <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 border border-red-200 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                      <div className="flex items-center mb-4">
                        <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-md mr-3">
                          <span className="text-xl">⏰</span>
                        </div>
                        <h3 className="text-lg font-bold text-red-900">ETA</h3>
                      </div>
                      <p className="text-3xl font-bold text-red-700">
                        {realTimeETA || ambulanceETA || '...'}
                      </p>
                      <p className="text-sm text-red-600">
                        minutes {realTimeETA && '(live traffic)'}
                      </p>
                      {ambulanceDelay > 0 && (
                        <p className="text-xs text-orange-600">+{ambulanceDelay} min delay</p>
                      )}
                      
                      {/* Step 5D: Ambulance Progress Animation */}
                      {isTrackingAmbulance && ambulanceProgress > 0 && (
                        <div className="mt-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-red-600">🚑 En Route</span>
                            <span className="text-xs text-red-600">{Math.round(ambulanceProgress)}%</span>
                          </div>
                          <div className="w-full bg-red-100 rounded-full h-2 overflow-hidden">
                            <div 
                              className="bg-gradient-to-r from-red-500 to-red-600 h-2 rounded-full transition-all duration-1000 ease-out transform"
                              style={{ 
                                width: `${ambulanceProgress}%`,
                                boxShadow: ambulanceProgress > 0 ? '0 0 10px rgba(239, 68, 68, 0.5)' : 'none'
                              }}
                            />
                          </div>
                          <p className="text-xs text-red-500 mt-1">
                            🚨 Ambulance {ambulanceProgress < 100 ? 'approaching' : 'has arrived!'}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 border border-red-200 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                      <div className="flex items-center mb-4">
                        <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-md mr-3">
                          <span className="text-xl">🚦</span>
                        </div>
                        <h3 className="text-lg font-bold text-red-900">Traffic</h3>
                      </div>
                      <div className="flex items-center">
                        <span className={`inline-block w-3 h-3 rounded-full mr-2 ${
                          trafficLevel === 'light' ? 'bg-green-500' :
                          trafficLevel === 'moderate' ? 'bg-yellow-500' : 'bg-red-500'
                        }`}></span>
                        <p className="text-sm font-medium capitalize">{trafficLevel}</p>
                      </div>
                      {currentRoute && (
                        <p className="text-xs text-gray-600 mt-1">
                          Live route data
                        </p>
                      )}
                      {isRerouting && (
                        <p className="text-xs text-purple-600 mt-1">🤖 AI analyzing...</p>
                      )}
                    </div>
                  </div>

                  {/* Emergency Log */}
                  <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 border border-red-200 shadow-lg">
                    <div className="flex items-center mb-4">
                      <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-md mr-3">
                        <span className="text-lg">📋</span>
                      </div>
                      <h3 className="text-lg font-bold text-red-900">Emergency Timeline</h3>
                    </div>
                    
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {emergencyLog.map((entry, index) => (
                        <div key={index} className="flex items-start">
                          <span className="text-xs text-gray-500 mr-2 mt-1 min-w-0">
                            {new Date().toLocaleTimeString()}
                          </span>
                          <p className="text-sm text-gray-700">{entry}</p>
                        </div>
                      ))}
                      {currentPhase === 'complete' && (
                        <div className="mt-2 p-2 bg-green-50 rounded text-sm text-green-700">
                          ✅ Simulation completed successfully
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}



          {/* Location & Hospital Info */}
          <div className="mb-12">
            {/* Live Map View */}
            <div className="mb-8">
              <div className="text-center mb-6">
                <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
                  🗺️ Live Location Map
                </h2>
                <div className="text-center">
                  {hospitalsLoading && (
                    <span className="text-sm text-blue-600 animate-pulse">
                      <span className="inline-block animate-spin">🔄</span> Loading nearby hospitals...
                    </span>
                  )}
                  {liveHospitals.length > 0 && (
                    <span className="text-sm text-green-600">
                      ✅ {liveHospitals.length} live hospitals loaded
                    </span>
                  )}
                </div>
              </div>
              <GoogleMapComponent
                userLocation={location ? { lat: location.latitude, lng: location.longitude } : null}
                hospitals={liveHospitals.length > 0 ? liveHospitals : londonHospitals}
                ambulanceLocation={undefined}
                showRoute={isEmergencyActive}
                routeData={currentRoute}
                ambulanceProgress={isTrackingAmbulance ? ambulanceProgress : undefined}
                useLiveHospitals={true} // Testing Places API - Step 2C
                onHospitalSelect={(hospital) => {
                  console.log('Hospital selected:', hospital.name);
                }}
                onHospitalsLoaded={(apiHospitals) => {
                  console.log('🏥 Loaded hospitals from API:', apiHospitals);
                  setLiveHospitals(apiHospitals);
                  setHospitalsLoading(false);
                  
                  if (apiHospitals.length > 0) {
                    console.log('✅ Hospital state updated with', apiHospitals.length, 'live hospitals');
                    console.log('✅ Ambulance dispatch now ready!');
                  } else {
                    console.log('⚠️ No hospitals found - using fallback data');
                    // Note: UI will automatically fall back to londonHospitals if liveHospitals is empty
                  }
                }}
              />
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Location Status */}
              <div className="bg-white/80 backdrop-blur-lg border border-gray-200 rounded-3xl shadow-2xl p-6 transition-all duration-300 hover:shadow-3xl">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-md">
                      <span className="text-xl">📍</span>
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">Your Location</h2>
                  </div>
                  <button
                    onClick={requestLocation}
                    disabled={locationLoading}
                    className="text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400"
                  >
                    {locationLoading ? 'Getting...' : 'Refresh'}
                  </button>
                </div>
                
                {locationLoading && (
                  <div className="flex items-center text-gray-600">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                    <span className="text-sm">Getting your location...</span>
                  </div>
                )}
                
                {locationError && !manualLocationMode && (
                  <div className="text-red-600 text-sm space-y-3">
                    <p>{locationError}</p>
                    <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                      <p className="text-yellow-800 text-sm font-medium">🔧 How to enable location:</p>
                      <ul className="text-yellow-700 text-xs mt-1 space-y-1">
                        <li>• Click the location icon in your browser address bar</li>
                        <li>• Select "Allow" when prompted</li>
                        <li>• Refresh this page</li>
                      </ul>
                    </div>
                    <button
                      onClick={() => setManualLocationMode(true)}
                      className="bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700 transition-colors"
                    >
                      📝 Enter Location Manually
                    </button>
                  </div>
                )}

                {manualLocationMode && (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-gray-900">🔍 Search for your location:</p>
                    <div className="relative">
                      <input
                        ref={addressInputRef}
                        type="text"
                        placeholder="Start typing an address... (e.g., 123 Main St, London)"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        onFocus={() => {
                          // Initialize autocomplete when user focuses on input
                          setTimeout(initializeAutocomplete, 100);
                        }}
                      />
                      <div className="absolute right-3 top-2 text-gray-400">
                        🗺️
                      </div>
                    </div>
                    
                    <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          const address = addressInputRef.current?.value;
                          if (address && address.trim()) {
                            // Use geocoding as fallback if autocomplete didn't work
                            setManualLocation(address, "Unknown City", "Unknown State");
                          } else {
                            ToastService.warning('Please enter an address');
                          }
                        }}
                        disabled={locationLoading}
                        className="flex-1 bg-green-600 text-white px-3 py-2 rounded text-sm hover:bg-green-700 transition-colors disabled:bg-gray-400"
                      >
                        {locationLoading ? '🔍 Searching...' : '✅ Use This Location'}
                      </button>
                      <button
                        onClick={() => setManualLocationMode(false)}
                        className="px-3 py-2 text-gray-600 hover:text-gray-800 text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                    
                    <p className="text-xs text-gray-500">
                      💡 Start typing and select from suggestions for accurate results.
                    </p>
                  </div>
                )}
                
                {location && !locationLoading && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-900">{location.address}</p>
                    <p className="text-sm text-gray-600">{location.city}, {location.state}</p>
                    <p className="text-xs text-gray-500">
                      Coordinates: {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                    </p>
                    <div className="mt-3 p-2 bg-green-50 rounded text-xs text-green-700">
                      ✅ Location ready for emergency services
                    </div>
                  </div>
                )}
              </div>

              {/* Nearest Hospitals */}
              <div className="bg-white/80 backdrop-blur-lg border border-gray-200 rounded-3xl shadow-2xl p-6 transition-all duration-300 hover:shadow-3xl">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-pink-600 rounded-xl flex items-center justify-center shadow-md">
                    <span className="text-xl">🏥</span>
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">Nearest Hospitals</h2>
                </div>
                <div className="space-y-3">
                  {(liveHospitals.length > 0 ? liveHospitals : londonHospitals).slice(0, 2).map((hospital, index) => (
                    <div key={index} className="border-b border-gray-100 pb-2 last:border-b-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 text-sm">{hospital.name}</p>
                          <p className="text-xs text-gray-600">{hospital.address}</p>
                          <div className="flex items-center mt-1 space-x-3">
                            <span className="text-xs text-blue-600">{hospital.distance} miles</span>
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              hospital.type === 'Trauma' 
                                ? 'bg-red-100 text-red-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}>
                              {hospital.type}
                            </span>
                          </div>
                        </div>
                        <a
                          href={`tel:${hospital.phone}`}
                          className="text-green-600 hover:text-green-800 text-sm ml-2"
                        >
                          📞
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Step 4: Emergency Simulation Summary Screen */}
          {currentPhase === 'complete' && simulationStats.startTime && (
            <div className="mb-6 animate-in fade-in duration-500">
              <div className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-200 rounded-xl p-6 shadow-lg transform animate-in zoom-in duration-300">
                <div className="text-center mb-6">
                  <div className="text-6xl mb-4">🎉</div>
                  <h2 className="text-2xl font-bold text-green-900 mb-2">
                    Emergency Simulation Complete!
                  </h2>
                  <p className="text-green-700 text-lg">
                    Thank you for trying out our AI-powered emergency response feature
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  {/* Simulation Duration */}
                  <div className="bg-white rounded-lg p-4 border border-green-200 text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {Math.floor(simulationStats.totalDuration / 60)}m {simulationStats.totalDuration % 60}s
                    </div>
                    <div className="text-sm text-gray-600">Total Duration</div>
                  </div>

                  {/* Final ETA */}
                  <div className="bg-white rounded-lg p-4 border border-green-200 text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {simulationStats.finalETA} min
                    </div>
                    <div className="text-sm text-gray-600">Response Time</div>
                  </div>

                  {/* Time Saved */}
                  <div className="bg-white rounded-lg p-4 border border-green-200 text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {simulationStats.timeSaved} min
                    </div>
                    <div className="text-sm text-gray-600">Time Saved vs 911</div>
                  </div>

                  {/* AI Optimizations */}
                  <div className="bg-white rounded-lg p-4 border border-green-200 text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {simulationStats.reroutingCount}
                    </div>
                    <div className="text-sm text-gray-600">AI Optimizations</div>
                  </div>
                </div>

                <div className="bg-white rounded-lg p-4 border border-green-200 mb-4">
                  <h3 className="font-semibold text-gray-900 mb-3">📊 Simulation Summary</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">🏥 Hospital:</span> {simulationStats.hospitalName}
                    </div>
                    <div>
                      <span className="font-medium">🚑 Ambulance:</span> {simulationStats.ambulanceId}
                    </div>
                    <div>
                      <span className="font-medium">⏰ Started:</span> {simulationStats.startTime.toLocaleTimeString()}
                    </div>
                    <div>
                      <span className="font-medium">🏁 Completed:</span> {simulationStats.endTime?.toLocaleTimeString()}
                    </div>
                    {simulationStats.trafficDelays > 0 && (
                      <div>
                        <span className="font-medium">🚦 Traffic Delays:</span> {simulationStats.trafficDelays} min
                      </div>
                    )}
                    {simulationStats.reroutingCount > 0 && (
                      <div>
                        <span className="font-medium">🤖 AI Reroutes:</span> {simulationStats.reroutingCount}
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                  <p className="text-blue-800 text-sm mb-2">
                    <strong>💡 This was a training simulation.</strong> In a real emergency, always call 911 immediately.
                  </p>
                  <p className="text-blue-700 text-xs">
                    Our AI-powered system demonstrates how technology could enhance emergency response times and coordination.
                  </p>
                </div>

                <div className="text-center mt-4">
                  <button
                    onClick={resetEmergency}
                    className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 hover:scale-105 hover:shadow-lg transition-all duration-200 transform active:scale-95"
                  >
                    🔄 Try Another Simulation
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Quick Emergency Contacts */}
          <div className="mb-12">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent mb-4">
                🚨 Emergency Services
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Quick access to emergency services and AI-powered ambulance dispatch
              </p>
            </div>
            <div className="flex items-center justify-between mb-6">
              
              {/* Demo Mode Toggle */}
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">
                  {demoMode ? '🚀 Demo Speed' : '⏱️ Real Time'}
                </span>
                <button
                  onClick={() => setDemoMode(!demoMode)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
                    demoMode ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                      demoMode ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <span className="text-xs text-gray-500">
                  {demoMode ? '5x faster' : 'Realistic timing'}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <button
                onClick={() => startEmergencySequence('high')}
                disabled={hospitalsLoading}
                className={`p-8 rounded-3xl text-center transition-all duration-300 transform focus:outline-none focus:ring-4 focus:ring-offset-2 shadow-xl ${
                  hospitalsLoading
                    ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                    : 'bg-gradient-to-r from-red-600 to-red-700 text-white hover:from-red-700 hover:to-red-800 hover:scale-105 hover:shadow-2xl focus:ring-red-300/30 active:scale-95 backdrop-blur-lg'
                }`}
              >
                <div className="text-2xl mb-2">
                  {hospitalsLoading ? <span className="animate-spin">⏳</span> : '🚨'}
                </div>
                <div className="font-bold text-lg">
                  {hospitalsLoading ? <span className="animate-pulse">Loading...</span> : 'Smart Emergency'}
                </div>
                <div className="text-sm">
                  {hospitalsLoading 
                    ? <span className="animate-pulse">Loading nearby hospitals...</span>
                    : 'AI-Powered Ambulance Dispatch'
                  }
                </div>
              </button>
              
              <a
                href="tel:+1-800-273-8255"
                className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-8 rounded-3xl text-center hover:from-blue-700 hover:to-indigo-800 hover:scale-105 hover:shadow-2xl transition-all duration-300 transform focus:outline-none focus:ring-4 focus:ring-blue-300/30 focus:ring-offset-2 active:scale-95 shadow-xl backdrop-blur-lg"
              >
                <div className="text-3xl mb-3">🧠</div>
                <div className="font-bold text-xl mb-2">Mental Health</div>
                <div className="text-sm opacity-90">Crisis Lifeline</div>
              </a>
              
              <a
                href="tel:+1-800-222-1222"
                className="bg-gradient-to-r from-green-600 to-emerald-700 text-white p-8 rounded-3xl text-center hover:from-green-700 hover:to-emerald-800 hover:scale-105 hover:shadow-2xl transition-all duration-300 transform focus:outline-none focus:ring-4 focus:ring-green-300/30 focus:ring-offset-2 active:scale-95 shadow-xl backdrop-blur-lg"
              >
                <div className="text-3xl mb-3">☠️</div>
                <div className="font-bold text-xl mb-2">Poison Control</div>
                <div className="text-sm opacity-90">1-800-222-1222</div>
              </a>
            </div>

            {/* Personal Emergency Contacts */}
            {emergencyContacts.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">👥 Personal Emergency Contacts</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {emergencyContacts.map((contact, index) => (
                    <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{contact.name}</p>
                          <p className="text-sm text-gray-600">{contact.relationship}</p>
                        </div>
                        <a
                          href={`tel:${contact.phone}`}
                          className="bg-green-600 text-white px-3 py-2 rounded-md text-sm hover:bg-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                        >
                          📞 Call
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  💡 Tip: Add your emergency contacts in Settings
                </p>
              </div>
            )}
          </div>

          {/* Emergency Scenarios */}
          <div className="mb-12">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-4">
                🎯 Practice Emergency Scenarios
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Learn life-saving skills through interactive scenario training and emergency response practice
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {emergencyScenarios.map((scenario) => (
                <div key={scenario.id} className="bg-white/80 backdrop-blur-lg border border-gray-200 rounded-3xl shadow-2xl p-6 transition-all duration-300 hover:shadow-3xl hover:scale-105">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-xl font-bold text-gray-900">{scenario.title}</h3>
                    <span className={`px-3 py-1 text-xs font-bold rounded-xl shadow-md ${
                      scenario.urgencyLevel === 'high' 
                        ? 'bg-gradient-to-r from-red-100 to-red-200 text-red-800 border border-red-300'
                        : scenario.urgencyLevel === 'medium'
                        ? 'bg-gradient-to-r from-yellow-100 to-yellow-200 text-yellow-800 border border-yellow-300'
                        : 'bg-gradient-to-r from-green-100 to-green-200 text-green-800 border border-green-300'
                    }`}>
                      {scenario.urgencyLevel.toUpperCase()}
                    </span>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-3">{scenario.description}</p>
                  
                  <div className="mb-4">
                    <p className="text-xs font-medium text-gray-700 mb-2">Key Symptoms:</p>
                    <ul className="text-xs text-gray-600 space-y-1">
                      {scenario.symptoms.slice(0, 3).map((symptom, index) => (
                        <li key={index}>• {symptom}</li>
                      ))}
                      {scenario.symptoms.length > 3 && (
                        <li className="text-gray-500">+ {scenario.symptoms.length - 3} more...</li>
                      )}
                    </ul>
                  </div>
                  
                  <div className="space-y-4">
                    <button
                      onClick={() => startPractice(scenario)}
                      className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-2xl text-sm font-bold hover:from-purple-700 hover:to-pink-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-purple-300/30 active:scale-95"
                    >
                      🎯 Practice Scenario
                    </button>
                    
                    <button
                      onClick={() => startEmergencySequence(scenario.urgencyLevel)}
                      disabled={hospitalsLoading}
                      className={`w-full px-6 py-3 rounded-2xl text-sm font-bold transition-all duration-300 transform focus:outline-none focus:ring-4 focus:ring-offset-2 shadow-lg ${
                        hospitalsLoading
                          ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                          : 'bg-gradient-to-r from-orange-600 to-red-600 text-white hover:from-orange-700 hover:to-red-700 hover:scale-105 hover:shadow-xl focus:ring-orange-300/30 active:scale-95'
                      }`}
                    >
                      {hospitalsLoading ? <><span className="animate-spin">⏳</span> <span className="animate-pulse">Loading...</span></> : '🚑 Smart Ambulance'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        /* Practice Mode */
        selectedScenario && (
          <div className="bg-white/80 backdrop-blur-lg border border-red-200 rounded-3xl shadow-2xl p-8 transition-all duration-300 hover:shadow-3xl">
            <div className="mb-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <span className="text-xl">🚨</span>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
                      Practicing: {selectedScenario.title}
                    </h2>
                    <p className="text-red-700">Emergency scenario training mode</p>
                  </div>
                </div>
                <button
                  onClick={resetPractice}
                  className="w-10 h-10 bg-red-100 text-red-600 rounded-xl hover:bg-red-200 hover:scale-110 transition-all duration-300 flex items-center justify-center shadow-md"
                  title="Exit practice"
                >
                  ✕
                </button>
              </div>
              
              {/* Progress */}
              <div className="mb-4">
                <div className="flex justify-between text-sm text-gray-600 mb-1">
                  <span>Step {practiceStep + 1} of {selectedScenario.steps.length}</span>
                  <span>{Math.round(((practiceStep + 1) / selectedScenario.steps.length) * 100)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-red-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${((practiceStep + 1) / selectedScenario.steps.length) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Current Step */}
            <div className="mb-8">
              <div className="bg-red-50/80 backdrop-blur-sm border border-red-200 rounded-2xl p-6 mb-6 shadow-lg">
                <h3 className="text-xl font-bold text-red-900 mb-4">
                  Step {practiceStep + 1}: {selectedScenario.steps[practiceStep]}
                </h3>
                
                {practiceStep === 0 && (
                  <div className="mt-4 bg-white rounded-lg p-4 border">
                    <p className="font-medium text-gray-900 mb-2">📞 Practice Call Script:</p>
                    <div className="bg-gray-50 p-3 rounded text-sm font-mono">
                      {selectedScenario.callScript}
                    </div>
                    <p className="text-xs text-gray-600 mt-2">
                      Read this script out loud to practice your emergency call
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center">
              <button
                onClick={resetPractice}
                className="px-6 py-3 text-gray-600 hover:text-gray-800 font-medium transition-all duration-300 hover:scale-105 focus:outline-none"
              >
                ← Back to Scenarios
              </button>
              
              {practiceStep < selectedScenario.steps.length - 1 ? (
                <button
                  onClick={nextStep}
                  className="bg-gradient-to-r from-red-600 to-orange-600 text-white px-8 py-3 rounded-2xl font-semibold hover:from-red-700 hover:to-orange-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-red-300/30"
                >
                  Next Step →
                </button>
              ) : (
                <button
                  onClick={resetPractice}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-8 py-3 rounded-2xl font-semibold hover:from-green-700 hover:to-emerald-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-green-300/30"
                >
                  ✅ Complete Practice
                </button>
              )}
            </div>
          </div>
        )
      )}
      </div>
    </div>
  );
}
