"""Run with Blender: blender -b --python scripts/render-poster.py -- proxy.json output.png.
This renders the actual procedural geometry, not a substitute model or AI mockup.
"""
import bpy, json, sys, math, random
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:]
source,output=args[0],args[1]
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene
scene.render.engine='CYCLES';scene.cycles.samples=96;scene.cycles.use_denoising=False
scene.render.resolution_x=1600;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.filepath=output
scene.world.color=(.002,.007,.005)
scene.view_settings.view_transform='AgX'
scene.view_settings.exposure=-.6
for entry in json.load(open(source)):
    vertices=entry['vertices'];faces=[(i,i+1,i+2) for i in range(0,len(vertices),3)]
    mesh=bpy.data.meshes.new(entry['name']);mesh.from_pydata(vertices,[],faces);mesh.update()
    obj=bpy.data.objects.new(entry['name'],mesh);bpy.context.collection.objects.link(obj)
    material=bpy.data.materials.new(entry['name']);material.use_nodes=True
    nodes=material.node_tree.nodes;links=material.node_tree.links;p=nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*entry['color'],1)
    p.inputs['Metallic'].default_value=entry['metalness'];p.inputs['Roughness'].default_value=entry['roughness']
    p.inputs['Coat Weight'].default_value=.3
    p.inputs['Emission Color'].default_value=(*entry['emission'],1);p.inputs['Emission Strength'].default_value=entry['emissionStrength']
    noise=nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=150;noise.inputs['Detail'].default_value=3
    bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.2;bump.inputs['Distance'].default_value=.012
    links.new(noise.outputs['Fac'],bump.inputs['Height']);links.new(bump.outputs['Normal'],p.inputs['Normal'])
    obj.data.materials.append(material)
    # Smooth only intrinsically curved triangles. Preserve flat mechanical panels.
    for poly in mesh.polygons:poly.use_smooth=True
    mesh.normals_split_custom_set_from_vertices(entry['normals'])
    bevel=obj.modifiers.new('Microscopic machined edges','BEVEL');bevel.width=.009;bevel.segments=2;bevel.limit_method='ANGLE'
    normal=obj.modifiers.new('Weighted surface normals','WEIGHTED_NORMAL');normal.keep_sharp=True

def area(name,loc,energy,color,size,target=(2,0,0)):
    data=bpy.data.lights.new(name,'AREA');data.energy=energy;data.color=color;data.shape='DISK';data.size=size
    obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj);obj.location=loc;obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
area('Mint softbox',(-1,-2,6),1600,(.71,1,.8),6)
area('Cyan rim',(3,3,3),1800,(.23,.94,.76),4)
area('Warm copper edge',(-4,-1,.3),650,(1,.58,.28),3)
area('Long reflection card',(5,-6,1.5),1100,(.8,1,.88),4)
# Deep teal volume and a nearly invisible seabed establish the same visual context.
bpy.ops.mesh.primitive_cube_add(size=48,location=(0,0,0));volume=bpy.context.object
mat=bpy.data.materials.new('Water');mat.use_nodes=True;n=mat.node_tree.nodes;n.clear()
out=n.new('ShaderNodeOutputMaterial');scatter=n.new('ShaderNodeVolumePrincipled');scatter.inputs['Density'].default_value=.004;scatter.inputs['Color'].default_value=(.21,.42,.34,1);scatter.inputs['Anisotropy'].default_value=.35;mat.node_tree.links.new(scatter.outputs['Volume'],out.inputs['Volume']);volume.data.materials.append(mat)
bpy.ops.mesh.primitive_plane_add(size=100,location=(0,0,-3.5));floor=bpy.context.object
mat=bpy.data.materials.new('Seabed');mat.diffuse_color=(.018,.045,.035,1);mat.roughness=1;floor.data.materials.append(mat)
random.seed(8)
for i in range(45):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=random.uniform(.1,.55),location=(random.uniform(-12,12),random.uniform(-5,12),-3.4))
    bpy.context.object.scale.z=.4;bpy.context.object.data.materials.append(mat)
# Camera matches the desktop WebGL starting pose and 38-degree vertical field of view.
bpy.ops.object.camera_add(location=(0,-12.6,1));cam=bpy.context.object
cam.rotation_euler=(Vector((0,0,0))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='PERSP';cam.data.sensor_fit='VERTICAL';cam.data.angle=math.radians(38);scene.camera=cam
cam.data.dof.use_dof=True;cam.data.dof.focus_distance=12.6;cam.data.dof.aperture_fstop=5.6
# Subtle optical bloom, applied only to emissive highlights.
scene.use_nodes=True;n=scene.node_tree.nodes;n.clear();r=n.new('CompositorNodeRLayers');g=n.new('CompositorNodeGlare');g.glare_type='FOG_GLOW';g.threshold=1.5;g.quality='MEDIUM';o=n.new('CompositorNodeComposite');scene.node_tree.links.new(r.outputs['Image'],g.inputs['Image']);scene.node_tree.links.new(g.outputs['Image'],o.inputs['Image'])
bpy.ops.wm.save_as_mainfile(filepath=output.rsplit('.',1)[0]+'.blend')
bpy.ops.render.render(write_still=True)
