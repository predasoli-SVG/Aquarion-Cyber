"""Compile and link shader fixtures on a headless EGL OpenGL ES 3 driver.
This is shader validation, not a substitute for browser/GPU performance QA.
Requires the system Mesa EGL library, no Python packages.
"""
import ctypes as C, json, sys
E=C.CDLL('libEGL.so.1')
E.eglGetProcAddress.argtypes=[C.c_char_p];E.eglGetProcAddress.restype=C.c_void_p
getdisplay=C.CFUNCTYPE(C.c_void_p,C.c_uint,C.c_void_p,C.POINTER(C.c_int))(E.eglGetProcAddress(b'eglGetPlatformDisplayEXT'))
d=getdisplay(0x31DD,None,None)
def egl(name,restype,args):
    fn=getattr(E,name);fn.restype=restype;fn.argtypes=args;return fn
initialize=egl('eglInitialize',C.c_uint,[C.c_void_p,C.POINTER(C.c_int),C.POINTER(C.c_int)])
major=C.c_int();minor=C.c_int();assert initialize(d,C.byref(major),C.byref(minor)), 'EGL unavailable'
bind=egl('eglBindAPI',C.c_uint,[C.c_uint]);assert bind(0x30A0)
attrs=(C.c_int*15)(0x3033,1,0x3040,0x40,0x3024,8,0x3023,8,0x3022,8,0x3021,8,0x3038,0,0)
config=C.c_void_p();count=C.c_int()
choose=egl('eglChooseConfig',C.c_uint,[C.c_void_p,C.POINTER(C.c_int),C.POINTER(C.c_void_p),C.c_int,C.POINTER(C.c_int)])
assert choose(d,attrs,C.byref(config),1,C.byref(count)) and count.value
surface=egl('eglCreatePbufferSurface',C.c_void_p,[C.c_void_p,C.c_void_p,C.POINTER(C.c_int)])(d,config,(C.c_int*5)(0x3057,1,0x3056,1,0x3038))
context=egl('eglCreateContext',C.c_void_p,[C.c_void_p,C.c_void_p,C.c_void_p,C.POINTER(C.c_int)])(d,config,None,(C.c_int*3)(0x3098,3,0x3038))
assert context and egl('eglMakeCurrent',C.c_uint,[C.c_void_p,C.c_void_p,C.c_void_p,C.c_void_p])(d,surface,surface,context)
def gl(name,ret,args):return C.CFUNCTYPE(ret,*args)(E.eglGetProcAddress(name.encode()))
create=gl('glCreateShader',C.c_uint,[C.c_uint]);source=gl('glShaderSource',None,[C.c_uint,C.c_int,C.POINTER(C.c_char_p),C.POINTER(C.c_int)]);compile=gl('glCompileShader',None,[C.c_uint]);status=gl('glGetShaderiv',None,[C.c_uint,C.c_uint,C.POINTER(C.c_int)]);log=gl('glGetShaderInfoLog',None,[C.c_uint,C.c_int,C.POINTER(C.c_int),C.c_char_p])
create_program=gl('glCreateProgram',C.c_uint,[]);attach=gl('glAttachShader',None,[C.c_uint,C.c_uint]);link=gl('glLinkProgram',None,[C.c_uint]);program_status=gl('glGetProgramiv',None,[C.c_uint,C.c_uint,C.POINTER(C.c_int)]);program_log=gl('glGetProgramInfoLog',None,[C.c_uint,C.c_int,C.POINTER(C.c_int),C.c_char_p])
failures=0
for fixture in json.load(open(sys.argv[1])):
    ids=[];good=True
    for stage,type in [('vertex',35633),('fragment',35632)]:
        shader=create(type);text=fixture[stage].encode();textptr=C.c_char_p(text);source(shader,1,C.byref(textptr),None);compile(shader);ok=C.c_int();status(shader,0x8B81,C.byref(ok));ids.append(shader)
        if not ok.value:
            buffer=C.create_string_buffer(16384);log(shader,len(buffer),None,buffer);print(f"FAIL {fixture['name']}/{stage}: {buffer.value.decode()}");good=False
    if good:
        program=create_program()
        for shader in ids:attach(program,shader)
        link(program);ok=C.c_int();program_status(program,0x8B82,C.byref(ok))
        if not ok.value:
            buffer=C.create_string_buffer(16384);program_log(program,len(buffer),None,buffer);print(f"FAIL LINK {fixture['name']}: {buffer.value.decode()}");good=False
    if good:print(f"PASS {fixture['name']} (vertex + fragment + link)")
    else:failures+=1
sys.exit(1 if failures else 0)
