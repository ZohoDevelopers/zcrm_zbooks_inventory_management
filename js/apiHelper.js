APIHelper = (function()
		{
	var booksApiKey  = undefined;
	var widgetLoadData = undefined;
	function mergeArray(obj){
		var temp = {};
		jQuery.each(obj,function(index,obj){

			temp = jQuery.extend(temp,obj);
		});
		return temp;
	}
	var statusToCheck = {
			PurchaseOrder : ["draft","open","partially_billed"],
			SalesOrder : ["draft","open","partially_billed"],
	}

	return {
		init : function(onLoadData)
		{
			if(onLoadData && onLoadData.LineItems && onLoadData.LineItems.length > 0)
			{
				return ZOHO.CRM.API.getOrgVariable(Utils.cons.authKeyField)
				.then(function(data){
					booksApiKey = data.Success.Content;
					widgetLoadData = onLoadData;
					return onLoadData;
				});
			}
			return Promise.reject({
				err : "NO_LINE_ITEM"
			});

		},
		getProductFromCRM : function(context)
		{
			return ZOHO.CRM.API.getRecord({Entity:"Products",RecordID:context.LineItem.ID})
			.then(function(data)
			{
				var productInfo = {};
				if(data && data.data && data.data instanceof Array)
				{
					productInfo = data.data[0];
				}
				context.ProdInfo = data;
				return context;	
				
			});

		},
		getPOFromBooks : function(context)
		{
			var req = {
					url : "https://books.zoho.com/api/v3/purchaseorders",
					params:{
						item_id:context.ItemInfo.item_id,
						authtoken:booksApiKey
					}
			};
			return ZOHO.CRM.HTTP.get(req)
			.then(function(response){
				var response = JSON.parse(response);
				if(response && response.message === 'success' && response.purchaseorders && response.purchaseorders.length > 0){
					context.POLists = response.purchaseorders
				}
				return context;
			});
		},
		getSOFromZBooks : function(context)
		{
			var req = {
					url : "https://books.zoho.com/api/v3/salesorders",
					params:{
						item_id:context.ItemInfo.item_id,
						authtoken:booksApiKey
					}
			};
			return ZOHO.CRM.HTTP.get(req)
			.then(function(response){
				var response = JSON.parse(response);
				if(response && response.message === 'success' && response.salesorders && response.salesorders.length > 0){
					context.SOLists = response.salesorders
				}
				return context;
			});
		},
		getItemFromZBooks : function(context)
		{
			var req = {
					url : "https://books.zoho.com/api/v3/items",
					params:{
						name:context.LineItem.Name,
						authtoken:booksApiKey
					}
			};

			return ZOHO.CRM.HTTP.get(req)
			.then(function(response){
				var response = JSON.parse(response);
				if(response && response.message === 'success' && response.items && response.items.length > 0){
					context.ItemInfo = response.items[0]
				}
				return context;
			})
		},
		getCompleteProdInfo : function(itemInfo)
		{
			/*
			 * fetch item info from books
			 */
			var itemPromise = APIHelper.getItemFromZBooks({LineItem:itemInfo})
			/*
			 * fetch SO and PO after fetching itemData
			 */
			var SOPromise = itemPromise
			.then(APIHelper.getSOFromZBooks);
			var POPromise = itemPromise
			.then(APIHelper.getPOFromBooks);
			/*
			 * Combine SO and PO data together
			 */
			var booksData = Promise.all([SOPromise,POPromise])
			.then(function(data){
					return mergeArray(data); 
				});

			/*
			 * Fetch ProductInfo from CRM
			 * To Extract Vendor Info
			 */
			var crmData = APIHelper.getProductFromCRM({LineItem:itemInfo});

			/*
			 * Merge Crm and Books data and return the promise
			 */
			return Promise.all([booksData,crmData])
			.then(function(data){
				return mergeArray(data);
			})
		},
		computeDataForStats : function(allData){
			/*
			 * Computing stock in hand
			 */
			var stockInHand = 0;
			if(allData.ItemInfo){
				stockInHand = allData.ItemInfo.stock_on_hand;
			}

			/*
			 * Computing quantity Ordered
			 */
			var stockOrdered = 0;
			if(allData.POLists && allData.POLists.length > 0 ){

				jQuery.each(allData.POLists,function(index,obj){
					if(obj && statusToCheck.PurchaseOrder.indexOf(obj.status) >= 0){
						stockOrdered += obj.item_quantity
					}
				});
			}

			/*
			 * Computing quantity already in demand
			 */
			var stockInDemand = 0;
			if(allData.SOLists && allData.SOLists.length > 0 ){

				jQuery.each(allData.SOLists,function(index,obj){

					if(obj && statusToCheck.SalesOrder.indexOf(obj.status) >= 0 ){
						stockInDemand += obj.item_quantity
					}
				});
			}
			var qtyRequired =parseInt(allData.LineItem.NewQuantity);
			var adjusment = (stockInHand+stockOrdered) - (stockInDemand+qtyRequired);
			allData.Stats = {
					stockInHand : stockInHand,
					stockOrdered : stockOrdered,
					stockInDemand : stockInDemand,
					adjusment : adjusment,
					purchase : (adjusment < 0 ? Math.abs(adjusment) : 0),
					isPurchaseRequired : (adjusment < 0 ? true : false)
			}
			return allData;
		},

		generateStats : function(itemInfo){
			
			return APIHelper.getCompleteProdInfo(itemInfo)
			.then(function(data){
				return APIHelper.computeDataForStats(data);
			})
		},
		createPurchaseOrder : function(){
			
			Utils.showLoading();
			
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
					Handler.widgetInit(widgetLoadData);
				}
			});
		},
		addLineItem : function(json){			
			var data = {
					$data:{},
					$lineItems:[json]
			}
			return ZOHO.CRM.UI.Record.populate(data)
		}
	}
})()
