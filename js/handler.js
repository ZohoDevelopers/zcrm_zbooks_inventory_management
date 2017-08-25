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
		authKeyField : "zcrmbooksinteg.booksAuth",
		priceFields : ["Unit_Price","Price_2","Price_3","Price_4"]
	},
	meta:{
		token : undefined
	}
};
Utils.showLoading = function(){
	$("body").addClass("loading");
}
Utils.hideLoading = function(){
	$("body").removeClass("loading");
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
Utils.initiateAutoComplete = function(obj){
	console.log(obj)
		obj.autocomplete({
			delay: 500,
			minLength: 1,
			autoFocus: true,
		  	source: function(request,callBack){
		  		
		  		ZOHO.CRM.API.searchRecord({
		  			Entity:"Vendors",
		  			Type:"criteria",
		  			Query:"(Vendor_Name:starts_with:"+request.term+")"
		  		}).then(function(data)
		  		{
		  		   if(data && data.data && data.data)
		  		   {	
			  			searchResult = data.data;
			  			var resultArr = [];
			  			data.data.forEach(function(obj){
		  				  resultArr.push({
		  						label: obj['Vendor_Name'], 
		  						value: obj
		  				  	});
		  			   });
		  		   }
		  			callBack(resultArr);
		  		});
		  	
		  	},
		  	/*
		  	 * remove the ID from the hidden field When a field is blurred with empty vendor name
		  	 */
		  	change: function( event, typedContent ) 
		  	{
		  		var target = $(event.target);
		  		if(target && target.val().length === 0)
		  		{
		  			$("#POVendor").val("");
		  		}
		  	},
		  	select:function( event, selectedVal)
		  	{
		  		console.log()
		  		event.preventDefault()
		  		if(selectedVal && selectedVal.item)
		  		{
		  			var temp = selectedVal.item;
		  			var label = temp.label;
		  			var obj = temp.value;
		  			
		  			
		  			$(event.target).val(label);
		  			$("#POVendor").val(obj.id);
		  		}
		  	}
		});	
}

Utils.ShowPurchaseOrder = function(){
	$(".reportTab").hide();
	$(".purchaseOrderCreation").show();
	Utils.initiateAutoComplete($("#POVendorSelection"));
}

/*
 * Main Bussiness logic
 */
var Handler = {};
Handler.initReport = function(data)
{
	Utils.showLoading();
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
		Utils.RenderTemplate("stockReport",data,Utils.hideLoading);
		
	})
	.catch(function(data)
	{
		if(data && data.err === 'NO_LINE_ITEM'){
			Utils.closePopUp();
		    alert("No line Item");
		}
	});
	
}
Handler.addLineItem = function()
{
	var json = {};
	$(".prdInfo").each(function(index,obj){
		var name = $(obj).attr("name");
		var val = $(obj).val();
		json[name] = val;
	});
	APIHelper.addLineItem(json);
}
Utils.initiateProductAutoComplete = function(obj){
	console.log(obj)
		obj.autocomplete({
			delay: 500,
			minLength: 1,
			autoFocus: true,
		  	source: function(request,callBack){
		  		
		  		ZOHO.CRM.API.searchRecord({
		  			Entity:"Products",
		  			Type:"criteria",
		  			Query:"(Product_Name:starts_with:"+request.term+")"
		  		}).then(function(data)
		  		{
		  		   if(data && data.data && data.data)
		  		   {	
			  			searchResult = data.data;
			  			var resultArr = [];
			  			data.data.forEach(function(obj){
		  				  resultArr.push({
		  						label: obj['Product_Name'], 
		  						value: obj
		  				  	});
		  			   });
		  		   }
		  			callBack(resultArr);
		  		});
		  	
		  	},
		  	/*
		  	 * remove the ID from the hidden field When a field is blurred with empty vendor name
		  	 */
		  	change: function( event, typedContent ) 
		  	{
		  		var target = $(event.target);
		  		if(target && target.val().length === 0)
		  		{
		  			$("#ProductName").val("");
		  		}
		  	},
		  	select:function( event, selectedVal)
		  	{
		  		event.preventDefault()
		  		if(selectedVal && selectedVal.item)
		  		{
		  			console.log(selectedVal.item.value);
		  			var rd = selectedVal.item.value;
		  			$("input[name='PRODUCTNAME']").val(rd.Product_Name);
		  			$("input[name='PRODUCTID']").val(rd.id);
		  			$("input[name='PRODUCTCODE']").val(rd.Product_Code);
		  			$("input[name='ISTAXABLE']").val(rd.Taxable);
		  			$("input[name='QUANTITY_IN_DEMAND']").val(rd.Qty_in_Demand);
		  			$("input[name='QUANTITY_IN_STOCK']").val(rd.Qty_in_Stock);
		  			$("input[name='USAGE_UNIT']").val(rd.Usage_Unit);
		  			$("input[name='VENDORID']").val( rd.Vendor_Name ? rd.Vendor_Name.id  : "");
		  			
		  			var optionsTag = "";
		  			$("select[name='UNITPRICE']").find("option").remove()
		  			Utils.cons.priceFields.forEach(function(obj){
		  			   $("select[name='UNITPRICE']").append($('<option>', { 
		  			        value: rd[obj],
		  			        text : rd[obj] 
		  			    }));
		  			});
		  			
		  		}
		  	}
		});	
}