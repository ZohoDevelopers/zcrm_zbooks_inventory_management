Handlebars.registerHelper('isPurchaseRequired', function(items,options) {
	    for(var i=0;i<items.length;i++){
    	var temp = items[i];
    	if(temp.isPurchaseRequired){
    		return options.fn(this);
    	}
    }
    return options.inverse(this);
});
Handlebars.registerHelper("inc", function(value, options)
{
    return parseInt(value) + 1;
});

/*
 * util methods
 */
Utils={
	cons:{
		authKeyField : "zcrmbooksinteg.booksAuth"
	},
	meta:{
		token : undefined
	}
};
Utils.showLoading = function(){
	$("#loadingDiv").show();
}
Utils.hideLoading = function(){
	$("#loadingDiv").hide();
}
Utils.successMsg = function(message){
	$('.successMsg').text(message);
	 $('.successMsg').slideDown(function() {
			$('.successMsg').delay(3000).slideUp();
			});
}
Utils.RenderTemplate=function(templateId , data,callBack){
	var template = $("#"+templateId).html();
	var compiledTemplate = Handlebars.compile(template);
	var widgetsDiv =$("#contentDiv");
	widgetsDiv.html(compiledTemplate(data));
	if(callBack)
	{
		callBack();
	}
};
Utils.genHtml=function(templateId,data,callBack){
	var template = $("#"+templateId).html();
	var compiledTemplate = Handlebars.compile(template);
	return compiledTemplate(data)
};
Utils.closePopUp = function(){
	ZOHO.CRM.UI.Popup.close()
};


Utils.ShowPurchaseOrder = function(){
	$(".reportTab").hide();
	$(".purchaseOrderCreation").show();
}

/*
 * Main Bussiness logic
 */
var Handler = {};
Handler.widgetInit = function(data)
{
	APIHelper.init(data)
	.then(function(pageContent){

		var allItemsPromise = [];
		jQuery.each(pageContent.LineItems,function(index,obj){
			allItemsPromise.push(APIHelper.generateStats(obj));
		});
		return Promise.all(allItemsPromise);
	})
	.then(function(allData){
		/*
		 * find atleast one vendor to pre populate
		 */
      	var vendor = undefined;
      	var isPurchaseRequired = false;;
      	$.each(allData,function(index,obj){
      		if(obj.ProdInfo.Vendor_Name){
      			vendor = obj.ProdInfo.Vendor_Name;
      		}
      		if(obj.Stats.isPurchaseRequired){
      			isPurchaseRequired = true;
      		}
      	});
      	
      	return {
      		data : allData,
      		vendor : vendor,
      		purchaseRequired : isPurchaseRequired
      	}
	})
	.then(function(data){
		console.log(data);
		Utils.RenderTemplate("stockReport",data);
	})
	.catch(function(data)
	{
		if(data && data.err === 'NO_LINE_ITEM'){
			Utils.closePopUp();
		    alert("No line Item");
		}
	  	
	});
	
}