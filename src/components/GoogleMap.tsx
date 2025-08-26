import React, { useEffect, useRef, useState, useCallback } from 'react';

interface Hospital {
  name: string;
  address: string;
  distance: number;
  phone: string;
  type: 'General' | 'Trauma' | 'Specialty';
  lat: number;
  lng: number;
}

interface GoogleMapProps {
  userLocation: { lat: number; lng: number } | null;
  hospitals: Hospital[];
  ambulanceLocation?: { lat: number; lng: number };
  showRoute?: boolean;
  routeData?: google.maps.DirectionsResult | null;
  ambulanceProgress?: number; // 0-100 percentage along route
  onHospitalSelect?: (hospital: Hospital) => void;
  useLiveHospitals?: boolean; // New prop to enable live hospital search
  onHospitalsLoaded?: (hospitals: Hospital[]) => void; // Callback when new hospitals are loaded
}

const GoogleMapComponent: React.FC<GoogleMapProps> = ({
  userLocation,
  hospitals,
  ambulanceLocation,
  showRoute,
  routeData,
  ambulanceProgress,
  onHospitalSelect,
  useLiveHospitals = false,
  onHospitalsLoaded
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);

  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const ambulanceMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const userLocationMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [hospitalsLoaded, setHospitalsLoaded] = useState(false);
  const lastLocationRef = useRef<string | null>(null);
  
  // User interaction tracking for camera following
  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const userInteractionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Smart centering control - only center initially or when appropriate
  const [hasInitialCentering, setHasInitialCentering] = useState(false);
  
  // Smart hospital marker management - track what's actually loaded
  const hospitalMarkersRef = useRef<Map<string, google.maps.marker.AdvancedMarkerElement>>(new Map());
  const [loadedHospitalIds, setLoadedHospitalIds] = useState<string[]>([]);

  // Load Google Maps API (Global Singleton)
  useEffect(() => {
    const loadGoogleMaps = async () => {
      try {
        // Check if Google Maps is already loaded and ready
        if (window.google && window.google.maps && window.google.maps.Map) {
          setIsMapLoaded(true);
      return;
    }

        // Check if loading is already in progress
        if ((window as unknown as { googleMapsLoading?: Promise<boolean> }).googleMapsLoading) {
          // Wait for existing loading to complete
          (window as unknown as { googleMapsLoading: Promise<boolean> }).googleMapsLoading.then(() => {
            if (window.google && window.google.maps && window.google.maps.Map) {
              setIsMapLoaded(true);
          } else {
              setMapError('Google Maps failed to load properly');
          }
          }).catch(() => {
            setMapError('Google Maps loading failed');
          });
        return;
      }

        const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
          throw new Error('Google Maps API key is not configured');
        }

        // Check if script already exists
        const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
        if (existingScript) {
          // Script exists, wait for it to load
          const checkLoaded = () => {
            if (window.google && window.google.maps && window.google.maps.Map) {
              setIsMapLoaded(true);
            } else {
              setTimeout(checkLoaded, 100); // Check again in 100ms
            }
          };
          checkLoaded();
          return;
        }
        
        // Create loading promise for other components to wait on
        (window as unknown as { googleMapsLoading: Promise<boolean> }).googleMapsLoading = new Promise((resolve, reject) => {
          // Create script element
          const script = document.createElement('script');
          script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,marker&map_ids=DEMO_MAP_ID`;
          script.async = true;
          script.defer = true;

          // Wait for script to load
          script.onload = () => {
            // Double-check that Google Maps is actually ready
            const checkReady = () => {
              if (window.google && window.google.maps && window.google.maps.Map) {
                setIsMapLoaded(true);
                resolve(true);
              } else {
                setTimeout(checkReady, 50); // Check again in 50ms
              }
            };
            checkReady();
          };

          script.onerror = () => {
            setMapError('Failed to load Google Maps API');
            reject(new Error('Failed to load Google Maps API'));
          };

          // Add script to document
          document.head.appendChild(script);
        });

        // Wait for our own loading promise
        await (window as unknown as { googleMapsLoading: Promise<boolean> }).googleMapsLoading;

      } catch (error) {
        setMapError(error instanceof Error ? error.message : 'Unknown error loading maps');
      }
    };

    loadGoogleMaps();

    // No cleanup - let the global script persist for other components
  }, []);

  // Load nearby hospitals using Google Places API
  const loadNearbyHospitals = useCallback(async (location: { lat: number; lng: number }, forceReload = false) => {
    if (!mapInstanceRef.current || !useLiveHospitals || (hospitalsLoaded && !forceReload)) return;

    try {
      console.log('🏥 Loading nearby hospitals via Google Places API...');
      
      const service = new google.maps.places.PlacesService(mapInstanceRef.current);
      
      const request: google.maps.places.PlaceSearchRequest = {
        location: new google.maps.LatLng(location.lat, location.lng),
        radius: 10000, // 10km radius
        type: 'hospital'
      };

      service.nearbySearch(request, (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          console.log('🏥 Found hospitals:', results.length);
          
          // Convert Places API results to our Hospital interface
          const apiHospitals: Hospital[] = results.slice(0, 10).map((place, index) => {
            // Calculate rough distance (simplified)
            const distance = place.geometry?.location ? 
              calculateDistance(location, {
                lat: place.geometry.location.lat(),
                lng: place.geometry.location.lng()
              }) : 0;

            return {
              name: place.name || `Hospital ${index + 1}`,
              address: place.vicinity || place.formatted_address || 'Address not available',
              distance: parseFloat(distance.toFixed(1)),
              phone: 'Contact via Google',
              type: place.types?.includes('hospital') ? 'General' : 'General',
              lat: place.geometry?.location?.lat() || location.lat,
              lng: place.geometry?.location?.lng() || location.lng
            };
          });

          console.log('🏥 Processed hospitals:', apiHospitals);
          
          // Notify parent component
          if (onHospitalsLoaded) {
            onHospitalsLoaded(apiHospitals);
          }
          
          setHospitalsLoaded(true); // Mark hospitals as loaded to prevent multiple calls
        } else {
          console.error('🏥 Places API error:', status);
          
          // Call callback with empty array to stop loading state
          if (onHospitalsLoaded) {
            onHospitalsLoaded([]);
          }
          
          setHospitalsLoaded(true); // Mark as loaded to prevent retry loops
        }
      });
    } catch (error) {
      console.error('🏥 Error loading hospitals:', error);
      
      // Call callback with empty array to stop loading state
      if (onHospitalsLoaded) {
        onHospitalsLoaded([]);
      }
      
      setHospitalsLoaded(true); // Mark as loaded to prevent retry loops
    }
  }, [useLiveHospitals, onHospitalsLoaded, hospitalsLoaded]);

  // Helper function to calculate distance between two points
  const calculateDistance = (point1: { lat: number; lng: number }, point2: { lat: number; lng: number }) => {
    const R = 6371; // Earth's radius in km
    const dLat = (point2.lat - point1.lat) * Math.PI / 180;
    const dLng = (point2.lng - point1.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
        Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Initialize map
  useEffect(() => {
    if (!isMapLoaded || !mapRef.current || mapInstanceRef.current) return;

    try {
      const defaultCenter = userLocation || { lat: 51.5074, lng: -0.1278 }; // London default

      const map = new google.maps.Map(mapRef.current, {
        center: defaultCenter,
        zoom: 13,
        mapId: 'DEMO_MAP_ID', // Required for AdvancedMarkerElement
        mapTypeControl: false,
        fullscreenControl: false,
        streetViewControl: false
        // Note: Cannot use custom styles with mapId - styles controlled via Google Cloud Console
      });

      mapInstanceRef.current = map;
      console.log('🗺️ Google Map initialized');
      
      // Add user interaction detection for camera following
      const handleUserInteraction = () => {
        setIsUserInteracting(true);
        
        // Clear existing timeout
        if (userInteractionTimeoutRef.current) {
          clearTimeout(userInteractionTimeoutRef.current);
        }
        
        // Resume auto-following after 3 seconds of no interaction
        userInteractionTimeoutRef.current = setTimeout(() => {
          setIsUserInteracting(false);
          console.log('👤 User interaction stopped - resuming ambulance following');
        }, 3000);
        
        console.log('👤 User interacting with map - pausing ambulance following');
      };
      
      // Listen for user interactions
      map.addListener('dragstart', handleUserInteraction);
      map.addListener('zoom_changed', handleUserInteraction);
      map.addListener('click', handleUserInteraction);

      // Initialize InfoWindow
      infoWindowRef.current = new google.maps.InfoWindow();

    } catch (error) {
      setMapError('Failed to initialize map');
      console.error('Map initialization error:', error);
    }
  }, [isMapLoaded, userLocation]);

  // Smart map centering - only when appropriate
  useEffect(() => {
    if (!mapInstanceRef.current || !userLocation) return;

    // Only center on user location initially (when map first loads with user location)
    if (!hasInitialCentering) {
      try {
        mapInstanceRef.current.setCenter(userLocation);
        setHasInitialCentering(true);
        console.log('🎯 Initial map centering on user location:', userLocation);
      } catch (error) {
        console.error('Error with initial map centering:', error);
      }
    }
    
    // Don't center again unless user explicitly requests it or there's no active tracking
  }, [userLocation, hasInitialCentering]);

  // Display route on map
  useEffect(() => {
    if (!mapInstanceRef.current || !isMapLoaded) return;

    try {
      // Initialize DirectionsRenderer if not exists
      if (!directionsRendererRef.current) {
        directionsRendererRef.current = new google.maps.DirectionsRenderer({
          suppressMarkers: true, // We'll use custom markers
          polylineOptions: {
            strokeColor: '#FF0000',
            strokeWeight: 4,
            strokeOpacity: 0.8
          }
        });
        directionsRendererRef.current.setMap(mapInstanceRef.current);
      }

      // Display route if provided
      if (routeData && showRoute) {
        directionsRendererRef.current.setDirections(routeData);
        console.log('🗺️ Route displayed on map');
      } else if (!showRoute && directionsRendererRef.current.getDirections()) {
        // Clear route when not showing (only if there was a route before)
        directionsRendererRef.current.setDirections(null);
      }

    } catch (error) {
      console.error('Error displaying route:', error);
    }
  }, [routeData, showRoute, isMapLoaded]);

  // Smart user location marker management - create once, update position
  useEffect(() => {
    if (!mapInstanceRef.current || !userLocation || !isMapLoaded) return;

    try {
      // If marker exists, just update its position (smooth, no blinking)
      if (userLocationMarkerRef.current) {
        userLocationMarkerRef.current.position = userLocation;
        console.log('📍 Updated user location position:', userLocation);
        
        // Handle hospital loading logic separately (without recreating marker)
        const stableLocationKey = `${userLocation.lat.toFixed(3)},${userLocation.lng.toFixed(3)}`;
        const isTrackingActive = ambulanceProgress !== undefined && ambulanceProgress > 0;
        
        if (useLiveHospitals && lastLocationRef.current !== stableLocationKey && !isTrackingActive) {
          lastLocationRef.current = stableLocationKey;
          
          // Reset hospital loading state to allow fresh loading for new location
          setHospitalsLoaded(false);
          
          loadNearbyHospitals(userLocation, true); // Force reload for new location
          console.log('🏥 Loading hospitals for stable location:', stableLocationKey);
        } else if (isTrackingActive) {
          console.log('🚑 Ambulance tracking active - skipping hospital reload');
        }
        return;
      }

      // Create marker only once (first time)
      console.log('📍 Creating user location marker for first time');
      
      // Add CSS animation (only if not already present)
      if (!document.getElementById('google-maps-pulse-animation')) {
        const style = document.createElement('style');
        style.id = 'google-maps-pulse-animation';
        style.textContent = `
          @keyframes pulse {
            0% { transform: scale(0.8); opacity: 1; }
            100% { transform: scale(2); opacity: 0; }
          }
        `;
        document.head.appendChild(style);
      }

      // Create custom user location marker element
      const userMarkerElement = document.createElement('div');
      userMarkerElement.innerHTML = `
        <div style="
          width: 20px; 
          height: 20px; 
          background: #4285f4; 
          border: 3px solid white; 
          border-radius: 50%; 
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          position: relative;
        ">
          <div style="
            width: 40px; 
            height: 40px; 
            background: rgba(66, 133, 244, 0.2); 
            border-radius: 50%; 
            position: absolute; 
            top: -13px; 
            left: -13px;
            animation: pulse 2s infinite;
          "></div>
        </div>
      `;

      // Create the marker and store reference
      userLocationMarkerRef.current = new google.maps.marker.AdvancedMarkerElement({
        position: userLocation,
        map: mapInstanceRef.current,
        content: userMarkerElement,
          title: 'Your Location'
        });

      // Initial hospital loading
      const stableLocationKey = `${userLocation.lat.toFixed(3)},${userLocation.lng.toFixed(3)}`;
      if (useLiveHospitals && lastLocationRef.current !== stableLocationKey) {
        lastLocationRef.current = stableLocationKey;
        
        // Reset hospital loading state for fresh loading
        setHospitalsLoaded(false);
        
        loadNearbyHospitals(userLocation, true); // Force initial loading
        console.log('🏥 Initial hospital loading for location:', stableLocationKey);
      }

    } catch (error) {
      console.error('Error managing user location marker:', error);
    }
  }, [isMapLoaded, userLocation, useLiveHospitals, loadNearbyHospitals, ambulanceProgress]);

  // Smart hospital marker management - update existing instead of recreating
  useEffect(() => {
    if (!mapInstanceRef.current || !hospitals.length || !isMapLoaded) return;

    try {
      // Get current hospital IDs for comparison
      const currentHospitalIds = hospitals.map(h => `${h.lat},${h.lng}`);
      const hasChanged = JSON.stringify(currentHospitalIds) !== JSON.stringify(loadedHospitalIds);
      
      if (!hasChanged) {
        console.log('🏥 Hospital list unchanged - keeping existing markers');
        return;
      }

      console.log('🏥 Hospital list changed - updating markers intelligently');
      
      // Remove markers that no longer exist
      hospitalMarkersRef.current.forEach((marker, id) => {
        if (!currentHospitalIds.includes(id)) {
          marker.map = null;
          hospitalMarkersRef.current.delete(id);
          console.log('🗑️ Removed hospital marker:', id);
        }
      });

      // Add or update markers for current hospitals
      hospitals.forEach((hospital, index) => {
        const hospitalId = `${hospital.lat},${hospital.lng}`;
        const isTrauma = hospital.type === 'Trauma';
        
        // If marker already exists, skip creating it
        if (hospitalMarkersRef.current.has(hospitalId)) {
          console.log('✅ Hospital marker already exists:', hospital.name);
          return;
        }

        // Create new marker only if it doesn't exist
        console.log('🆕 Creating new hospital marker:', hospital.name);
        
        const hospitalMarkerElement = document.createElement('div');
        
        hospitalMarkerElement.innerHTML = `
          <div style="
            width: 32px; 
            height: 32px; 
            background: ${isTrauma ? '#dc2626' : '#059669'}; 
            border: 2px solid white; 
            border-radius: 4px; 
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            color: white;
            font-weight: bold;
            cursor: pointer;
          ">
            ${isTrauma ? '🚨' : '🏥'}
          </div>
        `;

        const hospitalMarker = new google.maps.marker.AdvancedMarkerElement({
          position: { lat: hospital.lat, lng: hospital.lng },
          map: mapInstanceRef.current,
          content: hospitalMarkerElement,
          title: hospital.name
        });

        // Add click listener for info window
        hospitalMarkerElement.addEventListener('click', () => {
          if (infoWindowRef.current && mapInstanceRef.current) {
            const infoContent = `
              <div style="padding: 8px; max-width: 200px;">
                <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: bold; color: #1f2937;">
                  ${hospital.name}
                </h3>
                <p style="margin: 4px 0; font-size: 12px; color: #6b7280;">
                  📍 ${hospital.address}
                </p>
                <p style="margin: 4px 0; font-size: 12px; color: #6b7280;">
                  📏 ${hospital.distance} miles away
                </p>
                <p style="margin: 4px 0; font-size: 12px;">
                  <span style="
                    background: ${isTrauma ? '#fef2f2' : '#f0fdf4'}; 
                    color: ${isTrauma ? '#dc2626' : '#059669'}; 
                    padding: 2px 6px; 
                    border-radius: 12px; 
                    font-size: 10px;
                    font-weight: bold;
                  ">
                    ${hospital.type}
                  </span>
                </p>
                <button 
                  onclick="window.selectHospital(${index})" 
                  style="
                    background: #3b82f6; 
                    color: white; 
                    border: none; 
                    padding: 6px 12px; 
                    border-radius: 4px; 
                    font-size: 12px; 
                    cursor: pointer;
                    margin-top: 8px;
                  "
                >
                  Select Hospital
                </button>
              </div>
            `;

            infoWindowRef.current.setContent(infoContent);
            infoWindowRef.current.open(mapInstanceRef.current, hospitalMarker);

            // Set up global callback for hospital selection
            (window as unknown as { selectHospital: (index: number) => void }).selectHospital = (hospitalIndex: number) => {
              if (onHospitalSelect) {
                onHospitalSelect(hospitals[hospitalIndex]);
              }
              infoWindowRef.current?.close();
            };
          }
        });

        // Store marker reference for future updates
        hospitalMarkersRef.current.set(`${hospital.lat},${hospital.lng}`, hospitalMarker);
      });

      // Update loaded hospital IDs (reuse existing variable)
      setLoadedHospitalIds(currentHospitalIds);
        
      } catch (error) {
      console.error('Error creating hospital markers:', error);
    }
  }, [isMapLoaded, hospitals, onHospitalSelect, loadedHospitalIds]);

  // Calculate position along route based on progress percentage
  const calculatePositionAlongRoute = (route: google.maps.DirectionsResult, progress: number): { lat: number; lng: number } | null => {
    try {
      const path = route.routes[0]?.overview_path;
      if (!path || path.length === 0) return null;

      const progressClamped = Math.max(0, Math.min(100, progress));
      const pathIndex = Math.floor((progressClamped / 100) * (path.length - 1));
      const point = path[pathIndex];
      
      return {
        lat: point.lat(),
        lng: point.lng()
      };
    } catch (error) {
      console.error('Error calculating position along route:', error);
      return null;
    }
  };

  // Create/update ambulance marker with route tracking
  useEffect(() => {
    if (!mapInstanceRef.current || !isMapLoaded) return;

    try {
      // Calculate ambulance position
      let ambulancePosition: { lat: number; lng: number } | null = null;
      
      if (ambulanceLocation) {
        // Use provided ambulance location (legacy support)
        ambulancePosition = ambulanceLocation;
      } else if (routeData && ambulanceProgress !== undefined && ambulanceProgress >= 0) {
        // Calculate position along route based on progress
        ambulancePosition = calculatePositionAlongRoute(routeData, ambulanceProgress);
      }

      if (!ambulancePosition) {
        // Remove ambulance marker if no position
        if (ambulanceMarkerRef.current) {
          ambulanceMarkerRef.current.map = null;
          ambulanceMarkerRef.current = null;
        }
        return;
      }
      
      // If ambulance marker exists, smoothly update its position
      if (ambulanceMarkerRef.current) {
        // Smooth position update using Google Maps animation
        ambulanceMarkerRef.current.position = ambulancePosition;
        
        // Smoothly move camera to follow ambulance (if progress > 0 = actively tracking AND user not interacting)
        if (ambulanceProgress !== undefined && ambulanceProgress > 0 && !isUserInteracting) {
          mapInstanceRef.current.panTo(ambulancePosition);
          console.log(`📹 Camera following ambulance to: ${ambulancePosition.lat.toFixed(6)}, ${ambulancePosition.lng.toFixed(6)}`);
        } else if (isUserInteracting) {
          console.log(`👤 User interacting - skipping camera follow`);
        }
        return;
      }
      
      // Add smooth transition animation (only if not already present)
      if (!document.getElementById('ambulance-smooth-animation')) {
        const smoothStyle = document.createElement('style');
        smoothStyle.id = 'ambulance-smooth-animation';
        smoothStyle.textContent = `
          .ambulance-marker {
            transition: all 1s ease-in-out;
            will-change: transform;
          }
          .ambulance-marker:hover {
            transform: scale(1.1);
          }
        `;
        document.head.appendChild(smoothStyle);
      }

      // Create ambulance marker element
      const ambulanceMarkerElement = document.createElement('div');
      ambulanceMarkerElement.className = 'ambulance-marker';
      ambulanceMarkerElement.innerHTML = `
        <div style="
          width: 32px; 
          height: 32px; 
          background: #ff0000; 
          border: 3px solid white; 
          border-radius: 50%; 
          box-shadow: 0 3px 8px rgba(0,0,0,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          position: relative;
          z-index: 1000;
        ">
          🚑
        </div>
      `;

      ambulanceMarkerRef.current = new google.maps.marker.AdvancedMarkerElement({
        position: ambulancePosition,
        map: mapInstanceRef.current,
        content: ambulanceMarkerElement,
        title: `Ambulance${ambulanceProgress !== undefined ? ` (${Math.round(ambulanceProgress)}% complete)` : ''}`
      });

      console.log('🚑 Ambulance marker created:', ambulancePosition, ambulanceProgress !== undefined ? `${Math.round(ambulanceProgress)}%` : 'location-based');
      
      // Start camera following when ambulance tracking begins (progress > 0 AND user not interacting)
      if (ambulanceProgress !== undefined && ambulanceProgress > 0 && !isUserInteracting) {
        mapInstanceRef.current.panTo(ambulancePosition);
        console.log(`📹 Camera following new ambulance position: ${ambulancePosition.lat.toFixed(6)}, ${ambulancePosition.lng.toFixed(6)}`);
      }

    } catch (error) {
      console.error('Error creating ambulance marker:', error);
    }
  }, [isMapLoaded, ambulanceLocation, routeData, ambulanceProgress, isUserInteracting]);

  // Handle loading state
  if (mapError) {
  return (
      <div className="w-full h-96 bg-red-50 border border-red-200 rounded-lg flex items-center justify-center">
            <div className="text-center">
          <div className="text-red-600 text-4xl mb-4">❌</div>
          <h3 className="text-lg font-semibold text-red-900 mb-2">Map Loading Error</h3>
          <p className="text-red-700 text-sm">{mapError}</p>
            </div>
          </div>
    );
  }

  if (!isMapLoaded) {
    return (
      <div className="w-full h-96 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h3 className="text-lg font-semibold text-blue-900 mb-2">Loading Map</h3>
          <p className="text-blue-700 text-sm">Initializing Google Maps...</p>
          </div>
      </div>
    );
  }

  return (
    <div className="w-full h-96 rounded-lg overflow-hidden shadow-lg border border-gray-200">
      <div ref={mapRef} className="w-full h-full" />
    </div>
  );
};

export default GoogleMapComponent;
