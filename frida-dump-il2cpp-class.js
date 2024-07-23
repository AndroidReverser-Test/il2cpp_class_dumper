function hook_call_constructors() {
    let get_soname = null;
    let call_constructors_addr = null;
    let hook_call_constructors_addr = true;
    let soflags = [];
 
    let linker = null;
    if (Process.pointerSize == 4) {
        linker = Process.findModuleByName("linker");
    } else {
        linker = Process.findModuleByName("linker64");
    }
 
    let symbols = linker.enumerateSymbols();
    for (let index = 0; index < symbols.length; index++) {
        let symbol = symbols[index];
        if (symbol.name == "__dl__ZN6soinfo17call_constructorsEv") {
            call_constructors_addr = symbol.address;
        } else if (symbol.name == "__dl__ZNK6soinfo10get_sonameEv") {
            get_soname = new NativeFunction(symbol.address, "pointer", ["pointer"]);
        }
    }
    if (hook_call_constructors_addr && call_constructors_addr && get_soname) {
        Interceptor.attach(call_constructors_addr,{
            onEnter: function(args){
                let soinfo = args[0];
                let soname = get_soname(soinfo).readCString();
                if(soname!=null && !soflags.includes(soname)){
                    // console.log(soname);
                    if(soname.indexOf("libil2cpp.so")!=-1){
                        dump_class();
                    }
                    soflags.push(soname);
                }
            },
            onLeave:function(ret){
            }
        });
    }
}




function dump_class(){
    let il2cpp_base = Process.findModuleByName("libil2cpp.so").base;
    let InitLocked_addr = il2cpp_base.add(InitLocked_pianyi);
    let kclazz = NULL;
    
    Interceptor.attach(InitLocked_addr,{
        onEnter:function(args){
            kclazz = args[0];
            kclazzs.push(kclazz);
        }
    })
}

function get_class_info(){
    Interceptor.detachAll();
    let il2cpp_base = Process.findModuleByName("libil2cpp.so").base;
    let kclazz,kclazz_name,namespace,method,method_name,method_pointer,param_count,param,param_type,p_name,mstr,pclazz;
    const il2cpp_class_get_namespace = new NativeFunction(il2cpp_base.add(il2cpp_api["il2cpp_class_get_namespace"]),"pointer",["pointer"]);
    const il2cpp_class_get_name = new NativeFunction(il2cpp_base.add(il2cpp_api["il2cpp_class_get_name"]),"pointer",["pointer"]);
    const il2cpp_method_get_name = new NativeFunction(il2cpp_base.add(il2cpp_api["il2cpp_method_get_name"]),"pointer",["pointer"]);
    const il2cpp_class_get_methods = new NativeFunction(il2cpp_base.add(il2cpp_api["il2cpp_class_get_methods"]),"pointer",["pointer","pointer"]);
    const il2cpp_method_get_param_count = new NativeFunction(il2cpp_base.add(il2cpp_api["il2cpp_method_get_param_count"]),"int32",["pointer"]);
    const il2cpp_method_get_param = new NativeFunction(il2cpp_base.add(il2cpp_api["il2cpp_method_get_param"]),"pointer",["pointer","int32"]);
    const il2cpp_class_from_type = new NativeFunction(il2cpp_base.add(il2cpp_api["il2cpp_class_from_type"]),"pointer",["pointer"]);
    const path = "/data/data/"+package_name + "/files/class_info.log";
    const file = new File(path,"w");

    console.log(kclazzs.length,"class dumping");
    for(let i=0;i<kclazzs.length;i++){
        kclazz = kclazzs[i];
        kclazz_name = il2cpp_class_get_name(kclazz).readCString();
        namespace = il2cpp_class_get_namespace(kclazz).readCString();
        file.write("-------"+namespace+"-------"+kclazz_name+"-------\n");
        const iter = Memory.alloc(Process.pointerSize);
        method = il2cpp_class_get_methods(kclazz,iter);
        while(!method.isNull()){
            mstr = "";
            method_name = il2cpp_method_get_name(method).readCString();
            method_pointer = method.readPointer().sub(il2cpp_base);
            param_count = il2cpp_method_get_param_count(method);
            mstr += method_name + "(";
            for(let i=0;i<param_count;i++){
                param = il2cpp_method_get_param(method,i);
                pclazz = il2cpp_class_from_type(param);
                if(!pclazz.isNull()){
                    p_name = il2cpp_class_get_name(pclazz).readCString();
                    mstr += p_name+","
                }
            }
            mstr += ")  " + method_pointer+"\n";
            file.write(mstr);
            method = il2cpp_class_get_methods(kclazz,iter);
        }
        file.write("\n");
    }
    file.flush();
    file.close();
    console.log("success dump all,save to "+path);
}


function main(){
    hook_call_constructors();
}
 
//等游戏完全加载完成后主动调用get_class_info方法即可
//il2cpp_api,package_name,InitLocked_pianyi需要改动

var il2cpp_api = {
    "il2cpp_class_get_methods":0x4390c08,  
    "il2cpp_method_get_name":0x438df98,    
    "il2cpp_class_get_name":0x438de4c,     
    "il2cpp_class_get_type":0x438dedc,     
    "il2cpp_class_get_namespace":0x438de60,
    "il2cpp_method_get_param":0x438dfb4,   
    "il2cpp_method_get_param_count":0x438dfb0,
    "il2cpp_class_from_type":0x438ded4,
    };
var package_name = "com.netease.l22";
var InitLocked_pianyi = 0x4392928;//搜索because generic types cannot have explicit layout.定位


var kclazzs = [];
main();
