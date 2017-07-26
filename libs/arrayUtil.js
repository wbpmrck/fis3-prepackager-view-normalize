/**
 * Created by cuikai on 2015/9/17.
 * 数组相关的辅助方法
 */

/**
 * 去除数组里重复项的helper
 * @reverseOrder:遍历顺序，false为正序，true为逆序  默认正序：从0->length-1.
 * @param identifier(可选):filter函数，其用于决定item中的什么字段来决定item的唯一性
 * @private
 */
exports.removeArrayDump = function(arr,reverseOrder,/* optional */identifier){
    var _dic={},cut=false;
    if(!identifier){
        identifier = function(item){return item};
    }
    if(reverseOrder){
        for(var i=arr.length-1;i>=0;i--){
            var _item = arr[i],_key = identifier(_item);
            if(_dic[_key]){
                cut = true;
                arr.splice(i,1)
            }else{
                cut=false;
                _dic[_key] = true
            }
        }

    }else{
        for(var i= 0,j=arr.length;i<j;(cut&&j--) || i++){
            var _item = arr[i],_key = identifier(_item);
            if(_dic[_key]){
                cut = true;
                arr.splice(i,1)
            }else{
                cut=false;
                _dic[_key] = true
            }
        }
    }
}
