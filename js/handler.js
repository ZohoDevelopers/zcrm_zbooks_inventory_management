/*
 * util methods
 */
Utils={
	cons:{
		authKey : "testplugin.booksAuth"
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
}

var Handler = {};
Handler.getItemFromZCrm = function(item)
{
	return ZOHO.CRM.API.getRecord({Entity:"Products",RecordID:item.ID});
}

Handler.getItemFromZBooks = function(item)
{
    var req = {
      url : "https://books.zoho.com/api/v3/items",
      params:{
        name:item.Name,
        authtoken:Utils.meta.token
      }
    };
  return ZOHO.CRM.HTTP.get(req)
  .then(function(response){
    var response = JSON.parse(response);
    if(response && response.message === 'success' && response.items && response.items.length > 0){
      return response.items[0];
    }
  });
}
Handler.getItemData = function(item)
{
	var consolidatedData = {};
	
	var crmData = Handler.getItemFromZCrm(item)
	.then(function(data){
		consolidatedData.CrmData = data
	});

	var DeskData = Handler.getItemFromZBooks(item)
	.then(function(data){
		consolidatedData.DeskData = data
	});

	consolidatedData.LineItem = item;

	return Promise.all([crmData,DeskData])
	.then(function(){
		
		var stockInHand = 0;
		if(consolidatedData.DeskData){
			stockInHand = consolidatedData.DeskData.stock_on_hand;	
		}
		var stockOrdered = consolidatedData.CrmData.Qty_Ordered;
		var oldDemain = consolidatedData.CrmData.Qty_in_Demand;
		var newDemain = parseInt(consolidatedData.LineItem.NewQuantity);
		var adjusment = (stockInHand+stockOrdered) - (oldDemain+newDemain);
		consolidatedData.Calculation = {
			adjusment :  adjusment,
			purchase  : (adjusment < 0 ? Math.abs(adjusment) : 0)
		}
		consolidatedData.isPurchaseRequired = adjusment < 0 ? true : false

		return consolidatedData;
	});
}
var widget = {
	onLoadData : undefined
};
Handler.widgetInit = function(data)
{
	ZOHO.CRM.CONFIG.getOrgVariable(Utils.cons.authKey)
	.then(function(data){
		if(data && data.SUCCESS){
			Utils.meta.token = data.SUCCESS;
		}
	})
	.then(function(){
		  widget.onLoadData = data;
		  if(data && data.LineItems)
		  {
		    var lineItems = data.LineItems;
		    if(lineItems)
		    {
		      var itemDetails = [];
		      lineItems.forEach(function(item)
		      {
		      
		          itemDetails.push(Handler.getItemData(item));
		      
		      });
		      Promise.all(itemDetails)
		      .then(function(data){
		      	var vendor = undefined;
		      	$.each(data,function(index,obj){
		      		if(obj.CrmData.Vendor_Name){
		      			vendor = obj.CrmData.Vendor_Name;
		      		}
		      	});

		        console.log(data);
		        Utils.RenderTemplate("stockReport",{
		      		data:data,
		      		vendor : vendor
		      	});
		      });
		    }
		  }
		  else{
		  	Utils.closePopUp();
		    alert("No line Item");
		  }
	});
}
// HandleBar Helpers
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

widget.ShowPurchaseOrder = function(){
	$(".reportTab").hide();
	$(".purchaseOrderCreation").show();
}
widget.ShowSalesOrder = function(){
	$(".reportTab").show();
	$(".purchaseOrderCreation").hide();
}
widget.createPurchaseOrder = function(){

	var sub = $("#POSubject").val();
	var vendor = $("#POVendor").val();

	var products = [];
	$("input:checked").each(function(ind,obj){

		var productID = $(obj).attr("name");
		var qty = $("#"+productID+"_Qty").val();
		qty = parseInt(qty)
		var temp = {
			product:{
				id : productID
			},
			quantity : qty
		}
		products.push(temp);
	})
	var recordData = {
	        "Subject": sub,
			"Vendor_Name":vendor,
			"Product_Details":products,
			"Status":"Created"
	  }
	ZOHO.CRM.API.insertRecord({Entity:"Purchase_Orders",APIData:recordData}).then(function(data){

		if(data && data[0] && data[0].code === 'SUCCESS')
		{
			Handler.widgetInit(widget.onLoadData);
		}
	});
}