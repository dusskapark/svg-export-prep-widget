// SVG Export Prep Widget
// Scans ComponentSets in the parent container and creates organized instances for easy SVG export

const { widget } = figma;
const { AutoLayout, Text, Input, usePropertyMenu, useSyncedState } = widget;

interface ComponentSetInfo {
  id: string;
  name: string;
  childrenCount: number;
}

interface ComponentInfo {
  componentSetName: string;
  componentName: string;
  variantProperties: Record<string, string>;
  nodeId: string;
}

// Extract all variant properties from component
function extractVariantProperties(component: ComponentNode): Record<string, string> {
  const properties: Record<string, string> = {};
  
  // Get all variant properties
  if ('variantProperties' in component && component.variantProperties) {
    for (const [key, value] of Object.entries(component.variantProperties)) {
      if (typeof value === 'string') {
        properties[key] = value.toLowerCase();
      }
    }
  }
  
  // If no variant properties found, try to extract from name as fallback
  if (Object.keys(properties).length === 0) {
    const name = component.name.toLowerCase();
    const iconTypes = ['coloured', 'filled', 'outlined', 'thinned', 'universal'];
    
    for (const type of iconTypes) {
      if (name.includes(type)) {
        properties['type'] = type;
        break;
      }
    }
    
    // If still no properties, set default
    if (Object.keys(properties).length === 0) {
      properties['type'] = 'default';
    }
  }
  
  return properties;
}

// Find ComponentSet nodes in parent container
function findComponentSetsInParent(): { componentSets: ComponentSetInfo[], components: ComponentInfo[] } {
  const componentSets: ComponentSetInfo[] = [];
  const components: ComponentInfo[] = [];
  
  // Get all widgets on current page
  const widgets = figma.currentPage.findAll(node => node.type === 'WIDGET');
  
  if (widgets.length === 0) {
    return { componentSets, components };
  }
  
  // Get the first widget's parent
  const firstWidget = widgets[0];
  const parentNode = firstWidget.parent;
  
  if (!parentNode || !('children' in parentNode)) {
    return { componentSets, components };
  }
  
  // Scan only the parent container's direct children
  for (const child of parentNode.children) {
    if (child.type === 'COMPONENT_SET') {
      const componentSetName = child.name;
      
      componentSets.push({
        id: child.id,
        name: componentSetName,
        childrenCount: child.children.length
      });
      
      // Extract components from this ComponentSet
      for (const component of child.children) {
        if (component.type === 'COMPONENT') {
          const variantProperties = extractVariantProperties(component);
          
          components.push({
            componentSetName,
            componentName: component.name,
            variantProperties,
            nodeId: component.id
          });
        }
      }
    }
  }
  
  return { componentSets, components };
}

// Find the rightmost position of all nodes on the page
function findRightmostPosition(): number {
  const allNodes = figma.currentPage.findAll();
  let rightmostX = 0;
  
  for (const node of allNodes) {
    if ('absoluteBoundingBox' in node && node.absoluteBoundingBox) {
      const nodeRight = node.absoluteBoundingBox.x + node.absoluteBoundingBox.width;
      if (nodeRight > rightmostX) {
        rightmostX = nodeRight;
      }
    }
  }
  
  return rightmostX + 100; // Add 100px margin
}

// Create or find exportSVG frame
function createOrFindExportFrame(): Promise<FrameNode> {
  return new Promise((resolve) => {
    // Check if exportSVG frame already exists and delete it
    const existingFrame = figma.currentPage.findOne(node => 
      node.type === 'FRAME' && node.name === 'exportSVG'
    ) as FrameNode;
    
    if (existingFrame) {
      existingFrame.remove();
      console.log('🗑️ Removed existing exportSVG frame');
    }
    
    // Create new exportSVG frame
    const exportFrame = figma.createFrame();
    exportFrame.name = 'exportSVG';
    
    // Set up auto-layout with wrap
    exportFrame.layoutMode = 'HORIZONTAL';
    exportFrame.layoutWrap = 'WRAP';
    exportFrame.primaryAxisSizingMode = 'FIXED';
    exportFrame.counterAxisSizingMode = 'AUTO'; // This makes height HUG content
    
    // Set sizing
    exportFrame.layoutSizingVertical = 'HUG'; // Vertical HUG
    exportFrame.layoutSizingHorizontal = 'FIXED'; // Horizontal FIXED
    
    // Set spacing
    exportFrame.itemSpacing = 16; // Horizontal gap between instances
    exportFrame.counterAxisSpacing = 16; // Vertical gap between wrapped rows
    
    // Set padding
    exportFrame.paddingTop = 20;
    exportFrame.paddingBottom = 20;
    exportFrame.paddingLeft = 20;
    exportFrame.paddingRight = 20;
    
    // Set frame size and position - position to the right of all content
    const rightmostX = findRightmostPosition();
    exportFrame.resize(800, 100); // Initial size, height will grow with content
    exportFrame.x = rightmostX;
    exportFrame.y = 100;
    
    // Set background
    exportFrame.fills = [{
      type: 'SOLID',
      color: { r: 0.98, g: 0.98, b: 0.98 }, // Light gray background
      opacity: 1
    }];
    
    // Add stroke
    exportFrame.strokes = [{
      type: 'SOLID',
      color: { r: 0.8, g: 0.8, b: 0.8 }
    }];
    exportFrame.strokeWeight = 1;
    
    figma.currentPage.appendChild(exportFrame);
    
    console.log(`📍 Created exportSVG frame at x: ${rightmostX}`);
    
    resolve(exportFrame);
  });
}

// Filter components to avoid duplicates based on naming pattern
function filterUniqueComponents(components: ComponentInfo[], namingPattern: string): ComponentInfo[] {
  const seenNames = new Set<string>();
  const uniqueComponents: ComponentInfo[] = [];
  
  for (const component of components) {
    const instanceName = generateInstanceName(component, namingPattern);
    
    if (!seenNames.has(instanceName)) {
      seenNames.add(instanceName);
      uniqueComponents.push(component);
    }
  }
  
  return uniqueComponents;
}

// Create instances from components
function createInstancesFromComponents(components: ComponentInfo[], namingPattern: string): Promise<void> {
  return new Promise((resolve, reject) => {
    createOrFindExportFrame()
      .then((exportFrame) => {
        let createdCount = 0;
        const promises: Promise<void>[] = [];
        
        // Filter to get unique components based on naming pattern
        const uniqueComponents = filterUniqueComponents(components, namingPattern);
        
        for (const component of uniqueComponents) {
          const promise = figma.getNodeByIdAsync(component.nodeId)
            .then((componentNode) => {
              if (componentNode && componentNode.type === 'COMPONENT') {
                // Create instance
                const instance = (componentNode as ComponentNode).createInstance();
                
                // Set instance name using naming pattern
                instance.name = generateInstanceName(component, namingPattern);
                
                // Add instance to export frame
                exportFrame.appendChild(instance);
                
                createdCount++;
                
                console.log(`✅ Created instance: ${instance.name}`);
              }
            })
            .catch((error) => {
              console.error(`❌ Failed to create instance for ${component.componentSetName}:`, error);
            });
          
          promises.push(promise);
        }
        
        Promise.all(promises)
          .then(() => {
            if (createdCount > 0) {
              // Select the export frame to show the result
              figma.currentPage.selection = [exportFrame];
              figma.viewport.scrollAndZoomIntoView([exportFrame]);
              
              figma.notify(`✅ Created ${createdCount} instances in exportSVG frame`);
            } else {
              figma.notify('❌ No instances were created');
            }
            resolve();
          })
          .catch(reject);
      })
      .catch(reject);
  });
}

// Generate instance name based on naming pattern
function generateInstanceName(component: ComponentInfo, namingPattern: string): string {
  let instanceName = namingPattern;
  
  // Replace {componentSetName} placeholder
  instanceName = instanceName.replace(/{componentSetName}/g, component.componentSetName);
  
  // Replace variant property placeholders like {type}, {size}, etc.
  for (const [key, value] of Object.entries(component.variantProperties)) {
    const placeholder = `{${key}}`;
    instanceName = instanceName.replace(new RegExp(placeholder, 'g'), value);
  }
  
  // Replace {allVariants} with all variant properties
  const allVariants = Object.entries(component.variantProperties)
    .map(([key, value]) => `${key}=${value}`)
    .join(',');
  instanceName = instanceName.replace(/{allVariants}/g, allVariants);
  
  return instanceName;
}

// eslint-disable-next-line react-refresh/only-export-components,@typescript-eslint/explicit-function-return-type
export const Widget = () => {
  const [componentSets, setComponentSets] = useSyncedState<ComponentSetInfo[]>('componentSets', []);
  const [components, setComponents] = useSyncedState<ComponentInfo[]>('components', []);
  const [isScanning, setIsScanning] = useSyncedState<boolean>('isScanning', false);
  const [containerName, setContainerName] = useSyncedState<string>('containerName', '');
  const [namingPattern, setNamingPattern] = useSyncedState<string>('namingPattern', '{Theme}/{componentSetName}');

  // Scan function - now also creates instances automatically
  const handleScan = () => {
    setIsScanning(true);
    
    try {
      const result = findComponentSetsInParent();
      setComponentSets(result.componentSets);
      setComponents(result.components);
      
      // Get container name
      const widgets = figma.currentPage.findAll(node => node.type === 'WIDGET');
      let parentName = '';
      if (widgets.length > 0) {
        const parentNode = widgets[0].parent;
        if (parentNode) {
          parentName = parentNode.name;
          setContainerName(parentName);
        }
      }
      
      if (result.components.length === 0) {
        figma.notify('❌ No components found');
        setIsScanning(false);
      } else {
        figma.notify(`✅ Found ${result.components.length} components in ${result.componentSets.length} ComponentSets`);
        
        console.log(`🔍 Scanned ${result.components.length} components in ${result.componentSets.length} ComponentSets`);
        console.log(`📋 Components breakdown:`, result.components.reduce((acc, comp) => {
          // Use the first variant property as the grouping key, or 'default' if none
          const groupKey = Object.keys(comp.variantProperties).length > 0 
            ? Object.entries(comp.variantProperties)[0].join('=')
            : 'default';
          acc[groupKey] = (acc[groupKey] || 0) + 1;
          return acc;
        }, {} as Record<string, number>));
        
        // Filter unique components before creating instances
        const uniqueComponents = filterUniqueComponents(result.components, namingPattern);
        console.log(`🎯 Creating ${uniqueComponents.length} unique instances (filtered from ${result.components.length} total components)`);
        
        // Automatically create instances after scanning
        Promise.resolve(createInstancesFromComponents(result.components, namingPattern))
          .then(() => {
            // Success handled in createInstancesFromComponents
          })
          .catch((error) => {
            console.error('Failed to create instances:', error);
            figma.notify(`❌ Failed to create instances: ${error}`);
          })
          .finally(() => {
            setIsScanning(false);
          });
      }
      
    } catch (error) {
      console.error('Scan failed:', error);
      figma.notify(`❌ Scan failed: ${error}`);
      setIsScanning(false);
    }
  };

  // Reset function
  const handleReset = () => {
    setComponentSets([]);
    setComponents([]);
    setContainerName('');
    
    // Also remove exportSVG frame if it exists
    const existingFrame = figma.currentPage.findOne(node => 
      node.type === 'FRAME' && node.name === 'exportSVG'
    ) as FrameNode;
    
    if (existingFrame) {
      existingFrame.remove();
      figma.notify('🗑️ Removed exportSVG frame');
    }
  };

  // Property menu for actions (backup)
  usePropertyMenu(
    [
      {
        icon: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 1L8 15M1 8L15 8" stroke="white" stroke-width="2" stroke-linecap="round"/>
        </svg>`,
        itemType: 'action',
        propertyName: 'scan',
        tooltip: 'Scan icons and create instances',
      },
      {
        icon: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M2 2L14 14M2 14L14 2" stroke="white" stroke-width="2" stroke-linecap="round"/>
        </svg>`,
        itemType: 'action',
        propertyName: 'reset',
        tooltip: 'Reset',
      },
    ],
    (event) => {
      if (event.propertyName === 'scan') {
        handleScan();
      } else if (event.propertyName === 'reset') {
        handleReset();
      }
    },
  );

  // Group components by primary variant property
  const componentsByVariant: Record<string, ComponentInfo[]> = {};
  for (const component of components) {
    // Use the first variant property as the grouping key, or 'default' if none
    const groupKey = Object.keys(component.variantProperties).length > 0 
      ? Object.entries(component.variantProperties)[0].join('=')
      : 'default';
    
    if (!componentsByVariant[groupKey]) {
      componentsByVariant[groupKey] = [];
    }
    componentsByVariant[groupKey].push(component);
  }

  return (
    <AutoLayout
      cornerRadius={8}
      fill="#FFFFFF"
      padding={16}
      spacing={12}
      stroke="#E6E6E6"
      direction="vertical"
      width={300}
    >
      <Text fontSize={16} fontWeight="bold" fill="#000000" width={268}>
        Component Scanner
      </Text>
      
      {/* Naming Pattern Input */}
      <AutoLayout direction="vertical" spacing={4} width={268}>
        <Text fontSize={12} fontWeight="medium" fill="#333333" width={268}>
          Instance Naming Pattern:
        </Text>
        <Input
          value={namingPattern}
          onTextEditEnd={(e) => setNamingPattern(e.characters)}
          placeholder="{type}/{componentSetName}"
          fontSize={12}
          fill="#000000"
          width={268}
          inputFrameProps={{
            fill: "#FFFFFF",
            stroke: "#E6E6E6",
            cornerRadius: 4,
            padding: { vertical: 6, horizontal: 8 }
          }}
        />
        <Text fontSize={10} fill="#666666" width={268}>
          Available: {"{componentSetName}"}, {"{type}"}, {"{size}"}, {"{allVariants}"}, etc.
        </Text>
      </AutoLayout>
      
      {/* Action Buttons */}
      <AutoLayout spacing={8} direction="horizontal" width={268}>
        <AutoLayout
          onClick={handleScan}
          cornerRadius={6}
          fill={isScanning ? "#CCCCCC" : "#007AFF"}
          padding={{ vertical: 8, horizontal: 16 }}
          hoverStyle={{ fill: isScanning ? "#CCCCCC" : "#0056CC" }}
        >
          <Text fontSize={14} fill="#FFFFFF" fontWeight="medium">
            {isScanning ? "Processing..." : (components.length > 0 ? "Retry" : "Scan icons")}
          </Text>
        </AutoLayout>
        
        {(componentSets.length > 0 || containerName) ? (
          <AutoLayout
            onClick={handleReset}
            cornerRadius={6}
            fill="#FF3B30"
            padding={{ vertical: 8, horizontal: 16 }}
            hoverStyle={{ fill: "#D70015" }}
          >
            <Text fontSize={14} fill="#FFFFFF" fontWeight="medium">
              Reset
            </Text>
          </AutoLayout>
        ) : null}
      </AutoLayout>
      
      {isScanning ? (
        <Text fontSize={14} fill="#666666" width={268}>
          Processing...
        </Text>
      ) : null}

      
      {!isScanning && containerName ? (
        <AutoLayout direction="vertical" spacing={8} width={268}>
          <Text fontSize={14} fill="#333333" width={268}>
            Container: {containerName.length > 25 ? containerName.substring(0, 25) + '...' : containerName}
          </Text>
          <Text fontSize={14} fill="#333333" width={268}>
            ComponentSets: {componentSets.length}
          </Text>
          <Text fontSize={14} fill="#333333" width={268}>
            Total Components: {components.length}
          </Text>
        </AutoLayout>
      ) : null}
      
      {!isScanning && componentSets.length === 0 && !containerName ? (
        <Text fontSize={14} fill="#666666" width={268}>
          Click "Scan icons" to find ComponentSets and create instances
        </Text>
      ) : null}
      
      {!isScanning && Object.keys(componentsByVariant).length > 0 ? (
        <AutoLayout direction="vertical" spacing={8} width={268}>
          <Text fontSize={14} fontWeight="bold" fill="#000000" width={268}>
            Components by Variant:
          </Text>
          {Object.entries(componentsByVariant).map(([variant, variantComponents]) => (
            <AutoLayout key={variant} direction="vertical" spacing={4} width={268}>
              <Text fontSize={12} fontWeight="bold" fill="#333333" width={268}>
                {variant}: {variantComponents.length}
              </Text>
              {variantComponents.slice(0, 3).map((component) => (
                <Text key={component.nodeId} fontSize={11} fill="#666666" width={268}>
                  • {component.componentSetName.length > 30 ? component.componentSetName.substring(0, 30) + '...' : component.componentSetName}
                </Text>
              ))}
              {variantComponents.length > 3 ? (
                <Text fontSize={11} fill="#666666" width={268}>
                  ... and {variantComponents.length - 3} more
                </Text>
              ) : null}
            </AutoLayout>
          ))}
        </AutoLayout>
      ) : null}
    </AutoLayout>
  );
};

widget.register(Widget);
